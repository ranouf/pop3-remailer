using System.Text.Json;
using IMAPRemailer.Core.Email;
using IMAPRemailer.Core.Email.Configuration;
using Microsoft.Data.Sqlite;

namespace IMAPRemailer.Infrastructure.Persistence;

public sealed class SqliteTransferState : ITransferState, IDisposable
{
    private readonly SqliteConnection connection;

    /// <summary>Opens the SQLite state database and migrates legacy JSON state if present.</summary>
    /// <param name="settings">The local database path and job settings.</param>
    public SqliteTransferState(SqliteSettings settings)
    {
        SQLitePCL.Batteries_V2.Init();
        Directory.CreateDirectory(
            Path.GetDirectoryName(settings.DatabasePath)!
        );
        connection = new SqliteConnection(
            new SqliteConnectionStringBuilder
            {
                DataSource = settings.DatabasePath,
                Pooling = false,
            }.ToString()
        );
        connection.Open();

        using var createTable = connection.CreateCommand();
        createTable.CommandText = """
            CREATE TABLE IF NOT EXISTS imported_messages (
                uidl TEXT NOT NULL PRIMARY KEY
            );
            """;
        createTable.ExecuteNonQuery();

        var legacyPath = Path.ChangeExtension(settings.DatabasePath, ".json");
        if (File.Exists(legacyPath))
        {
            var uidls = JsonSerializer.Deserialize<string[]>(
                File.ReadAllText(legacyPath)
            )!;
            using var transaction = connection.BeginTransaction();
            foreach (var uidl in uidls)
            {
                using var insert = connection.CreateCommand();
                insert.Transaction = transaction;
                insert.CommandText =
                    "INSERT OR IGNORE INTO imported_messages (uidl) VALUES ($uidl);";
                insert.Parameters.AddWithValue("$uidl", uidl);
                insert.ExecuteNonQuery();
            }
            transaction.Commit();
            File.Move(legacyPath, legacyPath + ".migrated");
        }
    }

    /// <inheritdoc />
    public bool Contains(string sourceId)
    {
        using var command = connection.CreateCommand();
        command.CommandText =
            "SELECT EXISTS(SELECT 1 FROM imported_messages WHERE uidl = $uidl);";
        command.Parameters.AddWithValue("$uidl", sourceId);
        return (long)command.ExecuteScalar()! != 0;
    }

    /// <inheritdoc />
    public async Task MarkImportedAsync(
        string sourceId,
        CancellationToken cancellationToken
    )
    {
        using var command = connection.CreateCommand();
        command.CommandText =
            "INSERT OR IGNORE INTO imported_messages (uidl) VALUES ($uidl);";
        command.Parameters.AddWithValue("$uidl", sourceId);
        await command.ExecuteNonQueryAsync(cancellationToken);
    }

    /// <summary>Closes the SQLite connection.</summary>
    public void Dispose() => connection.Dispose();
}
