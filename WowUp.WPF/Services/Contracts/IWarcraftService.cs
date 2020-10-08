using System.Collections.Generic;
using System.Threading.Tasks;
using WowUp.Common.Enums;
using WowUp.Common.Models.Events;
using WowUp.Common.Models.Warcraft;
using WowUp.WPF.Models.WowUp;

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

        string GetClientFolderName(WowClientType clientType);
    }
}
