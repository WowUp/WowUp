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
        void InstallUpdate();

        Task<bool> IsUpdateAvailable();

        Task<LatestVersion> GetLatestClientVersion();
        Task<LatestVersion> GetLatestClientVersion(WowUpReleaseChannelType releaseChannelType);

        Task<ChangeLogFile> GetChangeLogFile();
        Task DownloadUpdate(Action<int> onProgress);
        Task CheckUpdaterApp(Action<int> onProgress = null);

        bool GetCollapseToTray();
        void SetCollapseToTray(bool enabled);

        WowClientType GetLastSelectedClientType();
        void SetLastSelectedClientType(WowClientType clientType);

        WowUpReleaseChannelType GetWowUpReleaseChannel();
        void SetWowUpReleaseChannel(WowUpReleaseChannelType type);

        AddonChannelType GetClientAddonChannelType(WowClientType clientType);
        void SetClientAddonChannelType(WowClientType clientType, AddonChannelType channelType);

        bool GetClientDefaultAutoUpdate(WowClientType clientType);
        void SetClientDefaultAutoUpdate(WowClientType clientType, bool autoUpdate);

        bool IsReScanRequired();
        void SetRequiredReScanCompleted();
    }
}
