using Flurl.Http;
using Microsoft.Extensions.Caching.Memory;
using Serilog;
using System;
using System.Diagnostics;
using System.IO;
using System.Linq;
using System.Threading.Tasks;
using WowUp.Common.Enums;
using WowUp.Common.Models;
using WowUp.Common.Services.Contracts;
using WowUp.WPF.Extensions;
using WowUp.WPF.Models;
using WowUp.WPF.Services.Contracts;
using WowUp.WPF.Utilities;
using Microsoft.Extensions.DependencyInjection;
using WowUp.WPF.Repositories.Contracts;
using WowUp.WPF.Entities;

namespace WowUp.WPF.Services
{
    public class WowUpService : IWowUpService
    {
        private const string ChangeLogUrl = "https://wowup-builds.s3.us-east-2.amazonaws.com/changelog/changelog.json";
        private const string LatestVersionUrlFormat = "https://wowup-builds.s3.us-east-2.amazonaws.com/v{0}/WowUp.zip";
        private const string ChangeLogFileCacheKey = "change_log_file";
        private const string CollapseToTrayKey = "collapse_to_tray";

        public const string WebsiteUrl = "https://wowup.io";

        private readonly IMemoryCache _cache;
        private readonly IDownloadService _downloadSevice;
        private readonly IServiceProvider _serviceProvider;
        private readonly IPreferenceRepository _preferenceRepository;

        public WowUpService(
            IMemoryCache memoryCache,
            IPreferenceRepository preferenceRepository,
            IServiceProvider serviceProvider,
            IDownloadService downloadService)
        {
            _cache = memoryCache;
            _downloadSevice = downloadService;
            _serviceProvider = serviceProvider;
            _preferenceRepository = preferenceRepository;

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
            var pref = _preferenceRepository.FindByKey(CollapseToTrayKey);
            if (pref == null)
            {
                pref = new Preference { Key = CollapseToTrayKey };
            }

            pref.Value = enabled.ToString();

            _preferenceRepository.SaveItem(pref);
        }

        public async Task<bool> IsUpdateAvailable()
        {
            var latestVersionStr = await GetLatestVersion();
            if (string.IsNullOrEmpty(latestVersionStr))
            {
                return false;
            }

            var latestVersion = new Version(latestVersionStr);
            var currentVersion = AppUtilities.CurrentVersion;

            return latestVersion > currentVersion;
        }

        public async Task<string> GetLatestVersionUrl()
        {
            var latestVersionString = await GetLatestVersion();
            return string.Format(LatestVersionUrlFormat, latestVersionString);
        }

        public async Task<string> GetLatestVersion()
        {
            var changeLogFile = await GetChangeLogFile();
            if(changeLogFile == null)
            {
                return string.Empty;
            }

            return changeLogFile.ChangeLogs?.FirstOrDefault()?.Version ?? string.Empty;
        }

        public async Task<ChangeLogFile> GetChangeLogFile()
        {
            ChangeLogFile changeLogFile;

            if (_cache.TryGetValue(ChangeLogFileCacheKey, out changeLogFile))
            {
                return changeLogFile;
            }

            try
            {
                changeLogFile = await ChangeLogUrl.GetJsonAsync<ChangeLogFile>();

                var cacheEntryOptions = new MemoryCacheEntryOptions()
                    .SetAbsoluteExpiration(TimeSpan.FromMinutes(10));

                _cache.Set(ChangeLogFileCacheKey, changeLogFile, cacheEntryOptions);

                return changeLogFile;
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

            //WowUpService.WebsiteUrl.OpenUrlInBrowser();
        }

        private void SetDefaultPreferences()
        {
            var pref = _preferenceRepository.FindByKey(CollapseToTrayKey);
            if (pref == null)
            {
                SetCollapseToTray(true);
            }
        }

    }
}
