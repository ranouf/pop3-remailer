using IMAPRemailer.Core.Email;
using IMAPRemailer.Core.Email.Configuration;
using Microsoft.Data.Sqlite;

namespace IMAPRemailer.Infrastructure.Persistence;

/// <summary>Stores the optional job settings chosen in the tray.</summary>
public sealed class SqliteJobOverridesStore : IJobOverridesStore
{
    private readonly string connectionString;

    public SqliteJobOverridesStore(SqliteSettings settings)
    {
        SQLitePCL.Batteries_V2.Init();
        Directory.CreateDirectory(
            Path.GetDirectoryName(settings.DatabasePath)!
        );
        connectionString = new SqliteConnectionStringBuilder
        {
            DataSource = settings.DatabasePath,
            Pooling = false,
        }.ToString();
        using var connection = new SqliteConnection(connectionString);
        connection.Open();
        using var command = connection.CreateCommand();
        command.CommandText = """
            CREATE TABLE IF NOT EXISTS job_overrides (
                id INTEGER PRIMARY KEY CHECK (id = 1),
                interval_minutes INTEGER,
                max_messages_per_run INTEGER
            );
            """;
        command.ExecuteNonQuery();
    }

    public async Task<JobOverrides> GetAsync(
        CancellationToken cancellationToken
    )
    {
        await using var connection = new SqliteConnection(connectionString);
        await connection.OpenAsync(cancellationToken);
        await using var command = connection.CreateCommand();
        command.CommandText =
            "SELECT interval_minutes, max_messages_per_run FROM job_overrides WHERE id = 1;";
        await using var reader = await command.ExecuteReaderAsync(
            cancellationToken
        );
        if (!await reader.ReadAsync(cancellationToken))
        {
            return new JobOverrides(null, null);
        }

        return new JobOverrides(
            reader.IsDBNull(0) ? null : reader.GetInt32(0),
            reader.IsDBNull(1) ? null : reader.GetInt32(1)
        );
    }

    public async Task SaveAsync(
        JobOverrides values,
        CancellationToken cancellationToken
    )
    {
        await using var connection = new SqliteConnection(connectionString);
        await connection.OpenAsync(cancellationToken);
        await using var command = connection.CreateCommand();
        command.CommandText = """
            INSERT INTO job_overrides (id, interval_minutes, max_messages_per_run)
            VALUES (1, $interval, $maximum)
            ON CONFLICT(id) DO UPDATE SET
                interval_minutes = excluded.interval_minutes,
                max_messages_per_run = excluded.max_messages_per_run;
            """;
        command.Parameters.AddWithValue(
            "$interval",
            (object?)values.IntervalMinutes ?? DBNull.Value
        );
        command.Parameters.AddWithValue(
            "$maximum",
            (object?)values.MaxMessagesPerRun ?? DBNull.Value
        );
        await command.ExecuteNonQueryAsync(cancellationToken);
    }
}
