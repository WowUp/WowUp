using Flurl.Http;
using Microsoft.Extensions.Caching.Memory;
using Microsoft.Extensions.DependencyInjection;
using Serilog;
using System;
using System.Threading.Tasks;
using WowUp.Common.Enums;
using WowUp.Common.Models;
using WowUp.Common.Models.WowUpApi.Response;
using WowUp.Common.Services.Contracts;
using WowUp.WPF.Entities;
using WowUp.WPF.Extensions;
using WowUp.WPF.Repositories.Contracts;
using WowUp.WPF.Utilities;

namespace WowUp.WPF.Services
{
    public class WowUpService : IWowUpService
    {
        private const string ChangeLogUrl = "https://wowup-builds.s3.us-east-2.amazonaws.com/changelog/changelog.json";
        private const string ChangeLogFileCacheKey = "change_log_file";
        private const string CollapseToTrayKey = "collapse_to_tray";
        private const string DefaultAddonChannelKey = "default_addon_channel";

        public const string WebsiteUrl = "https://wowup.io";

        private readonly ICacheService _cacheService;
        private readonly IServiceProvider _serviceProvider;
        private readonly IPreferenceRepository _preferenceRepository;
        private readonly IWowUpApiService _wowUpApiService;

        public WowUpService(
            ICacheService cacheService,
            IPreferenceRepository preferenceRepository,
            IServiceProvider serviceProvider,
            IWowUpApiService wowUpApiService)
        {
            _cacheService = cacheService;
            _serviceProvider = serviceProvider;
            _preferenceRepository = preferenceRepository;
            _wowUpApiService = wowUpApiService;

            SetDefaultPreferences();
        }

        public void ShowLogsFolder()
        {
            FileUtilities.AppLogsPath.OpenUrlInBrowser();
        }

        public bool GetCollapseToTray()
        {
            var pref = _preferenceRepository.FindByKey(CollapseToTrayKey);
            return pref != null && bool.Parse(pref.Value) == true;
        }

        public void SetCollapseToTray(bool enabled)
        {
            SetPreference(CollapseToTrayKey, enabled.ToString());
        }

        public AddonChannelType GetDefaultAddonChannel()
        {
            var pref = _preferenceRepository.FindByKey(DefaultAddonChannelKey);
            if (pref == null)
            {
                throw new Exception("Default addon channel preference not found");
            }

            return pref.Value.ToAddonChannelType();
        }

        public void SetDefaultAddonChannel(AddonChannelType type)
        {
            SetPreference(DefaultAddonChannelKey, type.ToString());
        }

        public async Task<bool> IsUpdateAvailable()
        {
            var latestVersionResponse = await GetLatestVersion();
            if (string.IsNullOrEmpty(latestVersionResponse?.Version))
            {
                Log.Error("Got empty WowUp version");
                return false;
            }

            var latestVersion = new Version(latestVersionResponse.Version.Replace("v", string.Empty));
            var currentVersion = AppUtilities.CurrentVersion;

            return latestVersion > currentVersion;
        }

        public async Task<LatestVersionResponse> GetLatestVersion()
        {
            return await _wowUpApiService.GetLatestVersion();
        }

        public async Task<ChangeLogFile> GetChangeLogFile()
        {
            ChangeLogFile changeLogFile;

            try
            {
                return await _cacheService.GetCache(ChangeLogFileCacheKey, async () =>
                {
                
                        changeLogFile = await ChangeLogUrl
                            .WithHeaders(HttpUtilities.DefaultHeaders)
                            .GetJsonAsync<ChangeLogFile>();

                        var cacheEntryOptions = new MemoryCacheEntryOptions()
                            .SetAbsoluteExpiration(TimeSpan.FromMinutes(10));

                        return changeLogFile;
                
                });
            }
            catch (Exception ex)
            {
                Log.Error(ex, "Failed to get change log file");
                return null;
            }
        }

        public async Task UpdateApplication(Action<ApplicationUpdateState, decimal> updateAction)
        {
            var isUpdateAvailable = await IsUpdateAvailable();
            if (!isUpdateAvailable)
            {
                return;
            }

            var updater = _serviceProvider.GetService<ApplicationUpdater>();
            updater.LatestVersionUrl = await GetLatestVersionUrl();

            updater.UpdateChanged += (sender, e) =>
            {
                updateAction?.Invoke(e.State, e.Progress);
            };

            await updater.Update();
        }

        private async Task<string> GetLatestVersionUrl()
        {
            var latestVersion = await GetLatestVersion();
            return latestVersion.Url;
        }

        private void SetDefaultPreferences()
        {
            var pref = _preferenceRepository.FindByKey(CollapseToTrayKey);
            if (pref == null)
            {
                SetCollapseToTray(true);
            }

            pref = _preferenceRepository.FindByKey(DefaultAddonChannelKey);
            if (pref == null)
            {
                SetDefaultAddonChannel(AddonChannelType.Stable);
            }
        }

        private void SetPreference(string key, string value)
        {
            var pref = _preferenceRepository.FindByKey(key);
            if (pref == null)
            {
                pref = new Preference { Key = key };
            }

            pref.Value = value;

            _preferenceRepository.SaveItem(pref);
        }

    }
}
