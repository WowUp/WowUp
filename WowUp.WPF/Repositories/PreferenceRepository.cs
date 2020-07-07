using SQLite;
using System;
using System.Collections.Generic;
using System.Linq;
using WowUp.WPF.Entities;
using WowUp.WPF.Repositories.Base;
using WowUp.WPF.Repositories.Contracts;

namespace WowUp.WPF.Repositories
{
    public class PreferenceRepository : BaseRepository<Preference>, IPreferenceRepository
    {
        public Preference FindByKey(string key)
        {
            return Query(table => table.FirstOrDefault(p => p.Key == key));
        }

        public bool AddItem(Preference item)
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

        public bool UpdateItem(Preference item)
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

        public bool DeleteItem(Preference preference)
        {
            throw new NotImplementedException();
        }

        public IEnumerable<Preference> Query(Func<TableQuery<Preference>, TableQuery<Preference>> action)
        {
            lock (_collisionLock)
            {
                var query = action.Invoke(_database.Table<Preference>());
                return query.AsEnumerable();
            }
        }

        public Preference Query(Func<TableQuery<Preference>, Preference> action)
        {
            lock (_collisionLock)
            {
                return action.Invoke(_database.Table<Preference>());
            }
        }

        public bool AddItems(IEnumerable<Preference> items)
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

        public bool SaveItems(IEnumerable<Preference> items)
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

        public bool DeleteItems(IEnumerable<Preference> addons)
        {
            throw new NotImplementedException();
        }
    }
}
