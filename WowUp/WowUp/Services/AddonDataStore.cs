using SQLite;
using System;
using System.Collections.Generic;
using System.Collections.ObjectModel;
using System.Linq;
using System.Threading.Tasks;
using WowUp.Entities;
using Xamarin.Forms;

namespace WowUp.Services
{
    public class AddonDataStore : IDataStore<Addon>
    {
        private static object collisionLock = new object();
        private SQLiteConnection database;

        public ObservableCollection<Addon> Addons { get; set; }

        public AddonDataStore()
        {
            database = DependencyService.Get<IDatabaseConnection>().DbConnection();
            database.CreateTable<Addon>();

            EnableWriteAheadLogging();
            
            Addons = new ObservableCollection<Addon>(database.Table<Addon>());
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
            lock (collisionLock)
            {
                if (item.Id != 0)
                {
                    database.Update(item);
                }
                else
                {
                    database.Insert(item);
                }
            }

            return true;
        }

        public bool UpdateItem(Addon item)
        {
            lock (collisionLock)
            {
                if (item.Id != 0)
                {
                    database.Update(item);
                }
                else
                {
                    database.Insert(item);
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
            lock (collisionLock)
            {
                var query = action.Invoke(database.Table<Addon>());
                return query.AsEnumerable();
            }
        }

        public Addon Query(Func<TableQuery<Addon>, Addon> action)
        {
            lock (collisionLock)
            {
                return action.Invoke(database.Table<Addon>());
            }
        }

        public bool AddItems(IEnumerable<Addon> items)
        {
            lock (collisionLock)
            {
                foreach (var item in items)
                {
                    if (item.Id != 0)
                    {
                        database.Update(item);
                    }
                    else
                    {
                        database.Insert(item);
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
                database.Execute("PRAGMA journal_mode = 'wal'");
            }
            catch(Exception)
            {
                // eat
            }
        }
    }
}
