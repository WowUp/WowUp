using System.Collections.Generic;
using System.Threading.Tasks;
using WowUp.WPF.Models;

namespace WowUp.WPF.Services.Contracts
{
    public interface IWarcraftService
    {
        Task<IList<string>> GetWowClientNames();
        Task<IList<WowClientType>> GetWowClients();

        Task<string> GetWowFolderPath();
        Task<bool> SetWowFolderPath(string folderPath);
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
