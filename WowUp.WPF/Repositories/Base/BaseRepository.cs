using Serilog;
using SQLite;
using System;
using System.Collections.Generic;
using System.IO;
using WowUp.WPF.Migrations;
using WowUp.WPF.Migrations.Contracts;
using WowUp.WPF.Repositories.Contracts;
using WowUp.WPF.Utilities;

namespace WowUp.WPF.Repositories.Base
{
    public class BaseRepository : IBaseRepository
    {
        private const string SchemaVersionKey = "schema_version";

        private static readonly IList<IMigration> _migrations = new List<IMigration>
            {
                new Version1Migration()
            };

        protected static object _collisionLock = new object();

        protected static SQLiteConnection _database;

        public BaseRepository()
        {
            if (_database == null)
            {
                _database = DbConnection();
                EnableWriteAheadLogging(_database);
                BootstrapDatabase(_database);
            }
        }

        public void ShutDown()
        {
            _database?.Close();
            _database?.Dispose();
        }

        public void MigrateDatabase()
        {
            var currentSchemaVersion = GetCurrentSchemaVersion(_database);
            foreach (var migration in _migrations)
            {
                if (currentSchemaVersion >= migration.TargetSchemaVersion)
                {
                    continue;
                }

                try
                {
                    migration.Execute(_database);

                    SetSchemaVersion(migration.TargetSchemaVersion, _database);
                }
                catch (Exception ex)
                {
                    Log.Error(ex, $"Migration failed {nameof(migration)}");
                    App.Current.Shutdown();
                }
            }
        }

        private void EnableWriteAheadLogging(SQLiteConnection connection)
        {
            // Enable write-ahead logging
            try
            {
                connection.Execute("PRAGMA journal_mode = 'wal'");
            }
            catch (Exception)
            {
                // eat
            }
        }

        private SQLiteConnection DbConnection()
        {
            var dbName = "WowUp.db3";
            var path = Path.Combine(FileUtilities.AppDataPath, dbName);
            return new SQLiteConnection(path);
        }

        private static int GetCurrentSchemaVersion(SQLiteConnection connection)
        {
            var versionStr = connection.ExecuteScalar<string>("SELECT value FROM wowup WHERE key = ?", SchemaVersionKey);
            return string.IsNullOrEmpty(versionStr) ? 0 : int.Parse(versionStr);
        }

        private static void BootstrapDatabase(SQLiteConnection connection)
        {
            try
            {
                connection.Execute("CREATE TABLE IF NOT EXISTS wowup ( key TEXT PRIMARY KEY, value TEXT NOT NULL )");

            }
            catch (Exception e)
            {
                Log.Error(e, "Failed to bootstrap database");
                App.Current.Shutdown();
            }
        }

        private static void SetSchemaVersion(int schemaVersion, SQLiteConnection connection)
        {
            connection.Execute("INSERT OR REPLACE INTO wowup (key, value) VALUES (?,?)", SchemaVersionKey, schemaVersion);
        }
    }
}
