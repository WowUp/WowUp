using System;
using System.Threading.Tasks;
using WowUp.Common.Enums;
using WowUp.Common.Models;
using WowUp.Common.Models.Events;
using WowUp.Common.Models.WowUpApi.Response;
using WowUp.WPF.Models.WowUp;

namespace WowUp.WPF.Services.Contracts
{
    public delegate void WowUpUpdateEventHandler(object sender, WowUpUpdateEventArgs e);
    public delegate void WowUpPreferenceEventHandler(object sender, WowUpPreferenceEventArgs e);

    public interface IWowUpService
    {
        event WowUpPreferenceEventHandler PreferenceUpdated;

        void ShowLogsFolder();

        Task<bool> IsUpdateAvailable();
        Task<LatestVersion> GetLatestVersion();
        Task<ChangeLogFile> GetChangeLogFile();
        Task UpdateApplication(Action<ApplicationUpdateState, decimal> updateAction);


        bool GetCollapseToTray();
        void SetCollapseToTray(bool enabled);

        AddonChannelType GetDefaultAddonChannel();
        void SetDefaultAddonChannel(AddonChannelType type);

        WowUpReleaseChannelType GetWowUpReleaseChannel();
        void SetWowUpReleaseChannel(WowUpReleaseChannelType type);
    }
}
