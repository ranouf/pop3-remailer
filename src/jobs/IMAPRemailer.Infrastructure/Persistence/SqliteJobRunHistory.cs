using System.Globalization;
using IMAPRemailer.Core.Email;
using IMAPRemailer.Core.Email.Configuration;
using IMAPRemailer.Core.Email.Models;
using Microsoft.Data.Sqlite;

namespace IMAPRemailer.Infrastructure.Persistence;

/// <summary>Stores synchronization history in the local SQLite database.</summary>
public sealed class SqliteJobRunHistory : IJobRunHistory
{
    private readonly string connectionString;
    private readonly JobSettings jobSettings;

    /// <summary>Creates the run history table when it does not exist.</summary>
    /// <param name="settings">The local SQLite database location.</param>
    /// <param name="jobSettings">The run retention period.</param>
    public SqliteJobRunHistory(SqliteSettings settings, JobSettings jobSettings)
    {
        this.jobSettings = jobSettings;
        SQLitePCL.Batteries_V2.Init();
        Directory.CreateDirectory(
            Path.GetDirectoryName(settings.DatabasePath)!
        );
        connectionString = new SqliteConnectionStringBuilder
        {
            DataSource = settings.DatabasePath,
            Pooling = false,
            ForeignKeys = true,
        }.ToString();

        using var connection = OpenConnection();
        using var journal = connection.CreateCommand();
        journal.CommandText = "PRAGMA journal_mode=WAL;";
        journal.ExecuteNonQuery();
        using var createTable = connection.CreateCommand();
        createTable.CommandText = """
            CREATE TABLE IF NOT EXISTS job_runs (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                started_at_utc TEXT NOT NULL,
                completed_at_utc TEXT,
                dry_run INTEGER NOT NULL,
                status TEXT NOT NULL,
                source_count INTEGER NOT NULL DEFAULT 0,
                imported INTEGER NOT NULL DEFAULT 0,
                already_present INTEGER NOT NULL DEFAULT 0,
                pending INTEGER NOT NULL DEFAULT 0,
                duration_ms REAL,
                error TEXT
            );
            """;
        createTable.ExecuteNonQuery();
        using var createLogs = connection.CreateCommand();
        createLogs.CommandText = """
            CREATE TABLE IF NOT EXISTS job_run_logs (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                run_id INTEGER NOT NULL REFERENCES job_runs(id) ON DELETE CASCADE,
                occurred_at_utc TEXT NOT NULL,
                level TEXT NOT NULL,
                message TEXT NOT NULL
            );
            CREATE INDEX IF NOT EXISTS ix_job_run_logs_run_id_id
                ON job_run_logs(run_id, id);
            """;
        createLogs.ExecuteNonQuery();
    }

    /// <inheritdoc />
    public async Task<long> StartRunAsync(
        bool dryRun,
        CancellationToken cancellationToken
    )
    {
        await using var connection = new SqliteConnection(connectionString);
        await connection.OpenAsync(cancellationToken);
        await using var purge = connection.CreateCommand();
        purge.CommandText = """
            DELETE FROM job_runs WHERE started_at_utc < $cutoff;
            """;
        purge.Parameters.AddWithValue(
            "$cutoff",
            DateTimeOffset
                .UtcNow.AddDays(-jobSettings.RunRetentionDays)
                .ToString("O", CultureInfo.InvariantCulture)
        );
        await purge.ExecuteNonQueryAsync(cancellationToken);
        await using var command = connection.CreateCommand();
        command.CommandText = """
            INSERT INTO job_runs (started_at_utc, dry_run, status)
            VALUES ($started, $dryRun, 'Running');
            SELECT last_insert_rowid();
            """;
        command.Parameters.AddWithValue(
            "$started",
            DateTimeOffset.UtcNow.ToString("O", CultureInfo.InvariantCulture)
        );
        command.Parameters.AddWithValue("$dryRun", dryRun ? 1 : 0);
        return (long)(await command.ExecuteScalarAsync(cancellationToken))!;
    }

    /// <inheritdoc />
    public async Task UpdateRunAsync(
        long runId,
        int sourceCount,
        int imported,
        int alreadyPresent,
        int pending,
        CancellationToken cancellationToken
    )
    {
        await using var connection = new SqliteConnection(connectionString);
        await connection.OpenAsync(cancellationToken);
        await using var command = connection.CreateCommand();
        command.CommandText = """
            UPDATE job_runs
            SET source_count = $sourceCount,
                imported = $imported,
                already_present = $alreadyPresent,
                pending = $pending
            WHERE id = $id;
            """;
        command.Parameters.AddWithValue("$id", runId);
        command.Parameters.AddWithValue("$sourceCount", sourceCount);
        command.Parameters.AddWithValue("$imported", imported);
        command.Parameters.AddWithValue("$alreadyPresent", alreadyPresent);
        command.Parameters.AddWithValue("$pending", pending);
        await command.ExecuteNonQueryAsync(cancellationToken);
    }

    /// <inheritdoc />
    public async Task CompleteRunAsync(
        long runId,
        JobRunResult result,
        CancellationToken cancellationToken
    )
    {
        await using var connection = new SqliteConnection(connectionString);
        await connection.OpenAsync(cancellationToken);
        await using var command = connection.CreateCommand();
        command.CommandText = """
            UPDATE job_runs
            SET completed_at_utc = $completed,
                status = $status,
                source_count = $sourceCount,
                imported = $imported,
                already_present = $alreadyPresent,
                pending = $pending,
                duration_ms = $durationMs,
                error = $error
            WHERE id = $id;
            """;
        command.Parameters.AddWithValue("$id", runId);
        command.Parameters.AddWithValue(
            "$completed",
            DateTimeOffset.UtcNow.ToString("O", CultureInfo.InvariantCulture)
        );
        command.Parameters.AddWithValue(
            "$status",
            result.Succeeded ? "Completed" : "Failed"
        );
        command.Parameters.AddWithValue("$sourceCount", result.SourceCount);
        command.Parameters.AddWithValue("$imported", result.Imported);
        command.Parameters.AddWithValue(
            "$alreadyPresent",
            result.AlreadyPresent
        );
        command.Parameters.AddWithValue("$pending", result.Pending);
        command.Parameters.AddWithValue(
            "$durationMs",
            result.Duration.TotalMilliseconds
        );
        command.Parameters.AddWithValue(
            "$error",
            (object?)result.Error ?? DBNull.Value
        );
        await command.ExecuteNonQueryAsync(cancellationToken);
    }

    /// <inheritdoc />
    public async Task<IReadOnlyList<JobRunSummary>> GetRecentRunsAsync(
        int count,
        CancellationToken cancellationToken
    )
    {
        await using var connection = new SqliteConnection(connectionString);
        await connection.OpenAsync(cancellationToken);
        await using var command = connection.CreateCommand();
        command.CommandText = """
            SELECT id, started_at_utc, completed_at_utc, dry_run, status,
                   source_count, imported, already_present, pending,
                   duration_ms, error
            FROM job_runs
            ORDER BY id DESC
            LIMIT $count;
            """;
        command.Parameters.AddWithValue("$count", count);
        var runs = new List<JobRunSummary>();
        await using var reader = await command.ExecuteReaderAsync(
            cancellationToken
        );
        while (await reader.ReadAsync(cancellationToken))
        {
            runs.Add(ReadRun(reader));
        }

        return runs;
    }

    /// <inheritdoc />
    public async Task<IReadOnlyList<JobRunSummary>> GetRunsAsync(
        CancellationToken cancellationToken
    )
    {
        await using var connection = new SqliteConnection(connectionString);
        await connection.OpenAsync(cancellationToken);
        await using var command = connection.CreateCommand();
        command.CommandText = """
            SELECT id, started_at_utc, completed_at_utc, dry_run, status,
                   source_count, imported, already_present, pending,
                   duration_ms, error
            FROM job_runs
            ORDER BY id;
            """;
        var runs = new List<JobRunSummary>();
        await using var reader = await command.ExecuteReaderAsync(
            cancellationToken
        );
        while (await reader.ReadAsync(cancellationToken))
        {
            runs.Add(ReadRun(reader));
        }

        return runs;
    }

    /// <inheritdoc />
    public async Task<IReadOnlyList<JobRunLog>> GetLogsAsync(
        long runId,
        long afterId,
        CancellationToken cancellationToken
    )
    {
        await using var connection = new SqliteConnection(connectionString);
        await connection.OpenAsync(cancellationToken);
        await using var command = connection.CreateCommand();
        command.CommandText = """
            SELECT id, run_id, occurred_at_utc, level, message
            FROM job_run_logs
            WHERE run_id = $runId AND id > $afterId
            ORDER BY id;
            """;
        command.Parameters.AddWithValue("$runId", runId);
        command.Parameters.AddWithValue("$afterId", afterId);
        var logs = new List<JobRunLog>();
        await using var reader = await command.ExecuteReaderAsync(
            cancellationToken
        );
        while (await reader.ReadAsync(cancellationToken))
        {
            logs.Add(
                new JobRunLog(
                    reader.GetInt64(0),
                    reader.GetInt64(1),
                    ParseDate(reader.GetString(2)),
                    reader.GetString(3),
                    reader.GetString(4)
                )
            );
        }

        return logs;
    }

    /// <inheritdoc />
    public async Task DeleteRunAsync(
        long runId,
        CancellationToken cancellationToken
    )
    {
        await using var connection = new SqliteConnection(connectionString);
        await connection.OpenAsync(cancellationToken);
        await using var command = connection.CreateCommand();
        command.CommandText = "DELETE FROM job_runs WHERE id = $runId;";
        command.Parameters.AddWithValue("$runId", runId);
        await command.ExecuteNonQueryAsync(cancellationToken);
    }

    /// <inheritdoc />
    public void AppendLog(long runId, string level, string message)
    {
        using var connection = OpenConnection();
        using var command = connection.CreateCommand();
        command.CommandText = """
            INSERT INTO job_run_logs (run_id, occurred_at_utc, level, message)
            VALUES ($runId, $occurred, $level, $message);
            """;
        command.Parameters.AddWithValue("$runId", runId);
        command.Parameters.AddWithValue(
            "$occurred",
            DateTimeOffset.UtcNow.ToString("O", CultureInfo.InvariantCulture)
        );
        command.Parameters.AddWithValue("$level", level);
        command.Parameters.AddWithValue("$message", message);
        command.ExecuteNonQuery();
    }

    #region Private

    /// <summary>Maps one SQLite row to a run summary.</summary>
    /// <param name="reader">The active SQLite reader.</param>
    /// <returns>The mapped run.</returns>
    private static JobRunSummary ReadRun(SqliteDataReader reader) =>
        new(
            reader.GetInt64(0),
            ParseDate(reader.GetString(1)),
            reader.IsDBNull(2) ? null : ParseDate(reader.GetString(2)),
            reader.GetInt64(3) != 0,
            reader.GetString(4),
            reader.GetInt32(5),
            reader.GetInt32(6),
            reader.GetInt32(7),
            reader.GetInt32(8),
            reader.IsDBNull(9) ? null : reader.GetDouble(9),
            reader.IsDBNull(10) ? null : reader.GetString(10)
        );

    /// <summary>Opens a separate connection for independent job and tray access.</summary>
    /// <returns>An open SQLite connection.</returns>
    private SqliteConnection OpenConnection()
    {
        var connection = new SqliteConnection(connectionString);
        connection.Open();
        return connection;
    }

    /// <summary>Parses a persisted UTC timestamp.</summary>
    /// <param name="value">The ISO 8601 timestamp.</param>
    /// <returns>The parsed timestamp.</returns>
    private static DateTimeOffset ParseDate(string value) =>
        DateTimeOffset.Parse(
            value,
            CultureInfo.InvariantCulture,
            DateTimeStyles.RoundtripKind
        );

    #endregion
}
