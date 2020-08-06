using System;
using System.Threading.Tasks;
using WowUp.Common.Enums;
using WowUp.Common.Models;
using WowUp.Common.Models.Events;

namespace WowUp.Common.Services.Contracts
{
    public delegate void WowUpUpdateEventHandler(object sender, WowUpUpdateEventArgs e);

    public interface IWowUpService
    {
        void ShowLogsFolder();

        Task<bool> IsUpdateAvailable();
        Task<string> GetLatestVersion();
        Task<string> GetLatestVersionUrl();
        Task<ChangeLogFile> GetChangeLogFile();
        Task UpdateApplication(Action<ApplicationUpdateState, decimal> updateAction);


        bool GetCollapseToTray();
        void SetCollapseToTray(bool enabled);
        AddonChannelType GetDefaultAddonChannel();
        void SetDefaultAddonChannel(AddonChannelType type);
    }
}
