using System.Collections.Generic;
using System.IO;
using System.Threading.Tasks;
using WowUp.Common.Enums;
using WowUp.Common.Models;
using WowUp.Common.Models.Events;
using WowUp.Common.Models.Warcraft;

namespace WowUp.WPF.Services.Contracts
{
    public delegate void WarcraftEventHandler(object sender, WarcraftEventArgs e);

    public interface IWarcraftService
    {
        event WarcraftEventHandler ProductChanged;

        IList<InstalledProduct> ScanProducts();
        IList<string> GetWowClientNames();
        IList<WowClientType> GetWowClientTypes();

        string GetClientLocation(WowClientType clientType);
        IList<string> GetClientLocations();
        bool IsClientFolder(WowClientType clientType, string folderPath);
        bool SetWowFolderPath(WowClientType clientType, string folderPath);

        string GetAddonFolderPath(WowClientType clientType);

        Task<IEnumerable<AddonFolder>> ListAddons(WowClientType clientType);
        Task<IEnumerable<FileInfo>> ListAddonFolders(WowClientType clientType);
    }
}
