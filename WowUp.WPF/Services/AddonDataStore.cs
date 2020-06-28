using SQLite;
using System;
using System.Collections.Generic;
using System.Collections.ObjectModel;
using System.IO;
using System.Linq;
using System.Threading.Tasks;
using WowUp.WPF.Entities;
using WowUp.WPF.Services.Base;
using WowUp.WPF.Services.Contracts;
using WowUp.WPF.Utilities;

namespace WowUp.WPF.Services
{
    public class AddonDataStore : SingletonService<AddonDataStore>, IDataStore<Addon>
    {
        private static object _collisionLock = new object();
        private SQLiteConnection _database;

        public ObservableCollection<Addon> Addons { get; set; }

        public AddonDataStore()
        {
            _database = DbConnection();
            _database.CreateTable<Addon>();

            EnableWriteAheadLogging();

            Addons = new ObservableCollection<Addon>(_database.Table<Addon>());
        }

        public Task<bool> AddItemAsync(Addon item)
        {
            throw new NotImplementedException();
        }

        public Task<bool> DeleteItemAsync(string id)
        {
            throw new NotImplementedException();
        }

        public Task<Addon> GetItemAsync(string id)
        {
            throw new NotImplementedException();
        }

        public Task<IEnumerable<Addon>> GetItemsAsync(bool forceRefresh = false)
        {
            throw new NotImplementedException();
        }

        public Task<bool> UpdateItemAsync(Addon item)
        {
            throw new NotImplementedException();
        }

        public bool AddItem(Addon item)
        {
            lock (_collisionLock)
            {
                item.UpdatedAt = DateTime.UtcNow;

                if (item.Id != 0)
                {
                    _database.Update(item);
                }
                else
                {
                    _database.Insert(item);
                }
            }

            return true;
        }

        public bool UpdateItem(Addon item)
        {
            lock (_collisionLock)
            {
                item.UpdatedAt = DateTime.UtcNow;

                if (item.Id != 0)
                {
                    _database.Update(item);
                }
                else
                {
                    _database.Insert(item);
                }
            }

            return true;
        }

        public bool DeleteItem(string id)
        {
            throw new NotImplementedException();
        }

        public IEnumerable<Addon> Query(Func<TableQuery<Addon>, TableQuery<Addon>> action)
        {
            lock (_collisionLock)
            {
                var query = action.Invoke(_database.Table<Addon>());
                return query.AsEnumerable();
            }
        }

        public Addon Query(Func<TableQuery<Addon>, Addon> action)
        {
            lock (_collisionLock)
            {
                return action.Invoke(_database.Table<Addon>());
            }
        }

        public bool AddItems(IEnumerable<Addon> items)
        {
            lock (_collisionLock)
            {
                foreach (var item in items)
                {
                    if (item.Id != 0)
                    {
                        _database.Update(item);
                    }
                    else
                    {
                        _database.Insert(item);
                    }
                }
            }

            return true;
        }

        private void EnableWriteAheadLogging()
        {
            // Enable write-ahead logging
            try
            {
                _database.Execute("PRAGMA journal_mode = 'wal'");
            }
            catch (Exception ex)
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
