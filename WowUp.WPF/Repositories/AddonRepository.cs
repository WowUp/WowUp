using SQLite;
using System;
using System.Collections.Generic;
using System.Linq;
using WowUp.Common.Enums;
using WowUp.WPF.Entities;
using WowUp.WPF.Repositories.Base;
using WowUp.WPF.Repositories.Contracts;

namespace WowUp.WPF.Repositories
{
    public class AddonRepository : BaseEntityRepository<Addon>, IAddonRepository
    {
        public bool AddItem(Addon item)
        {
            return SaveItem(item);
        }

        public bool SaveItem(Addon item)
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

        public bool DeleteItem(Addon addon)
        {
            lock (_collisionLock)
            {
                _database.Delete(addon);
            }
            return true;
        }

        public bool DeleteItems(IEnumerable<Addon> addons)
        {
            lock (_collisionLock)
            {
                foreach(var addon in addons)
                {
                    _database.Delete(addon);
                }
            }
            return true;
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
            return SaveItems(items);
        }

        public bool SaveItems(IEnumerable<Addon> items)
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

        public Addon GetByExternalId(string externalId, WowClientType clientType)
        {
            return Query(addons => 
                addons.FirstOrDefault(ad => ad.ClientType == clientType && ad.ExternalId == externalId));
        }
    }
}
