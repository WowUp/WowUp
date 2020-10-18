using SQLite;
using System;
using System.Collections.Generic;
using System.Linq;
using WowUp.WPF.Entities;
using WowUp.WPF.Repositories.Base;
using WowUp.WPF.Repositories.Contracts;

namespace WowUp.WPF.Repositories
{
    public class DependencyRepository : BaseEntityRepository<AddonDependency>, IDependencyRepository
    {
        public bool AddItem(AddonDependency item)
        {
            return SaveItem(item);
        }

        public bool SaveItem(AddonDependency item)
        {
            lock (_collisionLock)
            {
                _database.Insert(item);
            }

            return true;
        }

        public bool UpdateItem(AddonDependency item)
        {
            return SaveItem(item);
        }

        public bool DeleteItem(AddonDependency addon)
        {
            lock (_collisionLock)
            {
                _database.Execute("DELETE FROM AddonDependencies WHERE AddonId = ? AND DependencyId = ?", addon.AddonId, addon.DependencyId);
            }
            return true;
        }

        public bool DeleteItems(IEnumerable<AddonDependency> addons)
        {
            lock (_collisionLock)
            {
                foreach (var addon in addons)
                {
                    DeleteItem(addon);
                }
            }
            return true;
        }

        public IEnumerable<AddonDependency> Query(Func<TableQuery<AddonDependency>, TableQuery<AddonDependency>> action)
        {
            lock (_collisionLock)
            {
                var query = action.Invoke(_database.Table<AddonDependency>());
                return query.AsEnumerable();
            }
        }

        public AddonDependency Query(Func<TableQuery<AddonDependency>, AddonDependency> action)
        {
            lock (_collisionLock)
            {
                return action.Invoke(_database.Table<AddonDependency>());
            }
        }

        public IEnumerable<AddonDependency> GetAddonDependencies(Addon addon)
        {
            return Query(dependencies =>
                dependencies.Where(ad => ad.AddonId == addon.Id));
        }

        public IEnumerable<AddonDependency> GetDependentAddons(Addon addon)
        {
            return Query(dependencies =>
                dependencies.Where(ad => ad.DependencyId == addon.Id));
        }

        public bool AddItems(IEnumerable<AddonDependency> items)
        {
            return SaveItems(items);
        }

        public bool SaveItems(IEnumerable<AddonDependency> items)
        {
            lock (_collisionLock)
            {
                foreach (var item in items)
                {
                    _database.Insert(item);
                }
            }

            return true;
        }

        public bool RemoveAll()
        {
            lock (_collisionLock)
            {
                _database.Execute("DELETE FROM AddonDependencies");
            }
            return true;
        }
    }
}
