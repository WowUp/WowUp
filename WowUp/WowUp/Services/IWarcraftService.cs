using System.Collections.Generic;
using System.Threading.Tasks;
using WowUp.Models;

namespace WowUp.Services
{
    public interface IWarcraftService
    {
        Task<string> GetWowFolderPath();
        Task<string> GetRetailFolderPath();
        Task<string> GetClassicFolderPath();

        Task<string> GetAddonDirectory(WowClientType clientType);
        Task<string> GetRetailAddonFolderPath();
        Task<string> GetClassicAddonFolderPath();

        Task<IEnumerable<AddonFolder>> ListRetailAddons(bool forceReload = false);
        Task<IEnumerable<AddonFolder>> ListClassicAddons(bool forceReload = false);

        Task<string> SelectWowFolder();
    }
}
