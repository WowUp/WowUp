using SQLite;
using System;
using System.Collections.Generic;
using System.Linq;
using WowUp.WPF.Entities;
using WowUp.WPF.Repositories.Base;
using WowUp.WPF.Repositories.Contracts;

namespace WowUp.WPF.Repositories
{
    public class PreferenceRepository : BaseEntityRepository<Preference>, IPreferenceRepository
    {
        public event PreferenceEventHandler PreferenceUpdated;

        public Preference Create(string key, string value)
        {
            var pref = new Preference
            {
                Key = key,
                Value = value
            };

            SaveItem(pref);

            return pref;
        }

        public Preference FindByKey(string key)
        {
            return Query(table => table.FirstOrDefault(p => p.Key == key));
        }

        public IList<Preference> FindAllByKey(IEnumerable<string> keys)
        {
            return Query(table => table.Where(p => keys.Contains(p.Key))).ToList();
        }

        public bool AddItem(Preference item)
        {
            return SaveItem(item);
        }

        public bool SaveItem(Preference item)
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

            PreferenceUpdated?.Invoke(this, new Models.Events.PreferenceEventArgs(item));

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
            return SaveItems(items);
        }

        public bool SaveItems(IEnumerable<Preference> items)
        {
            lock (_collisionLock)
            {
                foreach (var item in items)
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
            }

            return true;
        }

        public bool DeleteItems(IEnumerable<Preference> addons)
        {
            throw new NotImplementedException();
        }
    }
}
