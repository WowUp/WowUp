using System.Collections.Generic;
using System.Threading.Tasks;
using WowUp.WPF.Models;

namespace WowUp.WPF.AddonProviders.Contracts
{
    public interface IAddonProvider
    {
        string Name { get; }

        Task<IList<AddonSearchResult>> GetAll(
            WowClientType clientType, 
            IEnumerable<string> addonIds);

        Task<IEnumerable<AddonSearchResult>> Search(
            string addonName,
            string folderName,
            WowClientType clientType,
            string nameOverride = null);
    }
}
