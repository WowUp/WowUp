using System.Collections.Generic;
using WowUp.WPF.Entities;

namespace WowUp.WPF.Repositories.Contracts
{
    public interface IDependencyRepository : IDataStore<AddonDependency>
    {
        IEnumerable<AddonDependency> GetAddonDependencies(Addon addon);

        IEnumerable<AddonDependency> GetDependentAddons(Addon addon);

        bool RemoveAll();
    }
}