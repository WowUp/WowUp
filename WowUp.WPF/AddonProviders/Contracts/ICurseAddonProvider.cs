using System.Collections.Generic;
using System.Threading.Tasks;
using WowUp.WPF.Models.Curse;
using WowUp.WPF.Models.WowUp;

namespace WowUp.WPF.AddonProviders.Contracts
{
    public interface ICurseAddonProvider : IAddonProvider
    {
        public Task<List<CurseScanResult>> GetScanResults(IEnumerable<AddonFolder> addonFolders);
    }
}
