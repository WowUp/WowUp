using System.Collections.Generic;
using System.Threading.Tasks;
using WowUp.WPF.Models;

namespace WowUp.WPF.Services.Contracts
{
    public interface IWarcraftService
    {
        Task<IList<string>> GetWowClientNames();
        Task<IList<WowClientType>> GetWowClients();

        bool ValidateWowFolder(string wowFolder);
        Task<string> GetWowFolderPath();
        Task<bool> SetWowFolderPath(string folderPath);
        Task<string> GetRetailFolderPath();
        Task<string> GetClassicFolderPath();

        Task<string> GetAddonFolderPath(WowClientType clientType);

        Task<IEnumerable<AddonFolder>> ListAddons(WowClientType clientType);
    }
}
