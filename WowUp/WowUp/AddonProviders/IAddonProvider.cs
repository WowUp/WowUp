using System.Collections.Generic;
using System.Threading.Tasks;
using WowUp.Models;

namespace WowUp.AddonProviders
{
    public interface IAddonProvider
    {
        string Name { get; }

        Task<IEnumerable<AddonSearchResult>> Search(
            string addonName,
            string folderName,
            WowClientType clientType,
            string nameOverride = null);
    }
}
