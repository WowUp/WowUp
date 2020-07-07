using SQLite;
using System;
using System.Collections.ObjectModel;
using System.IO;
using WowUp.WPF.Utilities;

namespace WowUp.WPF.Repositories.Base
{
    public class BaseRepository<T>
        where T : new()
    {
        protected static object _collisionLock = new object();

        protected SQLiteConnection _database;
        protected ObservableCollection<T> _entities;

        public BaseRepository()
        {
            _database = DbConnection();
            _database.CreateTable<T>();

            EnableWriteAheadLogging();

            _entities = new ObservableCollection<T>(_database.Table<T>());
        }

        private void EnableWriteAheadLogging()
        {
            // Enable write-ahead logging
            try
            {
                _database.Execute("PRAGMA journal_mode = 'wal'");
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
    }
}
