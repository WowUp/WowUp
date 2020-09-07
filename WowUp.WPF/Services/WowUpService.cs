using Flurl.Http;
using Microsoft.Extensions.Caching.Memory;
using Microsoft.Extensions.DependencyInjection;
using Serilog;
using System;
using System.Diagnostics;
using System.IO;
using System.Threading.Tasks;
using WowUp.Common.Enums;
using WowUp.Common.Models;
using WowUp.Common.Models.WowUpApi.Response;
using WowUp.Common.Services.Contracts;
using WowUp.WPF.Entities;
using WowUp.WPF.Extensions;
using WowUp.WPF.Models.WowUp;
using WowUp.WPF.Repositories.Contracts;
using WowUp.WPF.Services.Contracts;
using WowUp.WPF.Utilities;

namespace WowUp.WPF.Services
{

    public class WowUpService : IWowUpService
    {
        private const string ChangeLogUrl = "https://wowup-builds.s3.us-east-2.amazonaws.com/changelog/changelog.json";
        private const string ChangeLogFileCacheKey = "change_log_file";
        private const string UpdaterName = "WowUpUpdater.exe";
        private const string UpdateFileName = "WowUp.zip";

        public const string WebsiteUrl = "https://wowup.io";

        private static string LocalAppDataPath => Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData);
        private static bool UpdaterExists => File.Exists(UpdaterPath);
        private static FileVersionInfo UpdaterVersion => FileUtilities.GetFileVersion(UpdaterPath);

        private readonly ICacheService _cacheService;
        private readonly IDownloadService _downloadService;
        private readonly IServiceProvider _serviceProvider;
        private readonly IPreferenceRepository _preferenceRepository;
        private readonly IWowUpApiService _wowUpApiService;

        public static string ExecutablePath => Process.GetCurrentProcess().MainModule.FileName;
        public static string AppDataPath => Path.Combine(LocalAppDataPath, "WowUp");
        public static string AppLogsPath => Path.Combine(AppDataPath, "Logs");
        public static string DownloadPath => Path.Combine(AppDataPath, "Downloads");
        public static string UpdaterPath => Path.Combine(AppDataPath, UpdaterName);

        public event WowUpPreferenceEventHandler PreferenceUpdated;

        public WowUpService(
            ICacheService cacheService,
            IDownloadService downloadService,
            IPreferenceRepository preferenceRepository,
            IServiceProvider serviceProvider,
            IWowUpApiService wowUpApiService)
        {
            _cacheService = cacheService;
            _downloadService = downloadService;
            _serviceProvider = serviceProvider;
            _preferenceRepository = preferenceRepository;
            _wowUpApiService = wowUpApiService;

            SetDefaultPreferences();
        }

        public void ShowLogsFolder()
        {
            AppLogsPath.OpenUrlInBrowser();
        }

        public bool GetCollapseToTray()
        {
            var pref = _preferenceRepository.FindByKey(Constants.Preferences.CollapseToTrayKey);
            return pref != null && bool.Parse(pref.Value) == true;
        }

        public void SetCollapseToTray(bool enabled)
        {
            SetPreference(Constants.Preferences.CollapseToTrayKey, enabled.ToString());
        }

        public AddonChannelType GetDefaultAddonChannel()
        {
            var pref = _preferenceRepository.FindByKey(Constants.Preferences.DefaultAddonChannelKey);
            if (pref == null)
            {
                throw new Exception("Default addon channel preference not found");
            }

            return pref.Value.ToAddonChannelType();
        }

        public void SetDefaultAddonChannel(AddonChannelType type)
        {
            SetPreference(Constants.Preferences.DefaultAddonChannelKey, type.ToString());
        }

        public WowUpReleaseChannelType GetWowUpReleaseChannel()
        {
            var pref = _preferenceRepository.FindByKey(Constants.Preferences.WowUpReleaseChannelKey);
            if (pref == null)
            {
                throw new Exception("WowUp release channel not found");
            }

            return pref.Value.ToWowUpReleaseChannelType();
        }

        public void SetWowUpReleaseChannel(WowUpReleaseChannelType type)
        {
            SetPreference(Constants.Preferences.WowUpReleaseChannelKey, type.ToString());
        }

        public WowClientType GetLastSelectedClientType()
        {
            var pref = _preferenceRepository.FindByKey(Constants.Preferences.LastSelectedClientTypeKey);
            if (pref == null)
            {
                return WowClientType.None;
            }

            return pref.Value.ToWowClientType();
        }

        public void SetLastSelectedClientType(WowClientType clientType)
        {
            SetPreference(Constants.Preferences.LastSelectedClientTypeKey, clientType.ToString());
        }


        public async Task<bool> IsUpdateAvailable()
        {
            var releaseChannel = GetWowUpReleaseChannel();
            var latestServerVersion = await GetLatestVersion();

            if (string.IsNullOrEmpty(latestServerVersion?.Version))
            {
                Log.Error("Got empty WowUp version");
                return false;
            }

            var latestVersion = new Version(latestServerVersion.Version.TrimSemVerString());
            var currentVersion = new Version(AppUtilities.LongVersionName.TrimSemVerString());

            if (AppUtilities.IsBetaBuild && releaseChannel != WowUpReleaseChannelType.Beta)
            {
                return true;
            }

            return latestVersion > currentVersion;
        }

        public void InstallUpdate()
        {
            var updateFilePath = Path.Combine(DownloadPath, UpdateFileName);
            var updateExists = File.Exists(updateFilePath);

            if (!updateExists)
            {
                Log.Warning($"Cannot update, update file not found. {updateFilePath}");
                return;
            }

            var arguments = $"-o \"{ExecutablePath}\" -u \"{updateFilePath}\"";
            Log.Debug("Running updater");
            Log.Debug(arguments);

            Process.Start(new ProcessStartInfo
            {
                FileName = UpdaterPath,
                Arguments = arguments
            });

            AppUtilities.ShutdownApplication();
        }

        public async Task<LatestVersion> GetLatestVersion()
        {
            var response = await _wowUpApiService.GetLatestVersion();
            var releaseChannel = GetWowUpReleaseChannel();

            return releaseChannel == WowUpReleaseChannelType.Stable
                ? response.Stable
                : response.Beta;
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

        public async Task CheckUpdaterApp(Action<int> onProgress = null)
        {
            if (UpdaterExists)
            {
                await CheckUpdaterVersion(onProgress);
            }
            else
            {
                await InstallUpdater(onProgress);
            }
        }

        private async Task CheckUpdaterVersion(Action<int> onProgress = null)
        {
            var latestVersions = await _wowUpApiService.GetLatestVersion();
            var latestUpdaterVersion = new Version(latestVersions.Updater.Version.TrimSemVerString());
            var currentVersion = new Version(UpdaterVersion.ProductVersion.TrimSemVerString());

            if(latestUpdaterVersion > currentVersion)
            {
                await InstallUpdater(onProgress);
            }
        }

        private async Task InstallUpdater(Action<int> onProgress = null)
        {
            var downloadedZipPath = string.Empty;
            var unzippedDirPath = string.Empty;
            try
            {
                var latestVersions = await _wowUpApiService.GetLatestVersion();

                downloadedZipPath = await _downloadService.DownloadZipFile(
                    latestVersions.Updater.Url,
                    DownloadPath,
                    (progress) =>
                    {
                        onProgress?.Invoke(progress);
                    });

                unzippedDirPath = await _downloadService.UnzipFile(downloadedZipPath);
                var newUpdater = Path.Combine(unzippedDirPath, UpdaterName);
                var targetUpdater = Path.Combine(FileUtilities.AppDataPath, UpdaterName);

                FileUtilities.CopyFile(newUpdater, targetUpdater, true);
            }
            finally
            {
                if(!string.IsNullOrEmpty(downloadedZipPath) && File.Exists(downloadedZipPath))
                {
                    File.Delete(downloadedZipPath);
                }
                
                if(!string.IsNullOrEmpty(unzippedDirPath) && Directory.Exists(unzippedDirPath))
                {
                    Directory.Delete(unzippedDirPath, true);
                }
            }
        }

        public async Task DownloadUpdate(Action<int> onProgress)
        {
            var isUpdateAvailable = await IsUpdateAvailable();
            if (!isUpdateAvailable)
            {
                return;
            }

            var downloadedZipPath = string.Empty;
            try
            {
                var latestVersionUrl = await GetLatestVersionUrl();

                downloadedZipPath = await _downloadService.DownloadZipFile(
                        latestVersionUrl,
                        DownloadPath,
                        (progress) =>
                        {
                            onProgress?.Invoke(progress);
                        });
            }
            catch(Exception)
            {
                if(!string.IsNullOrEmpty(downloadedZipPath) && File.Exists(downloadedZipPath))
                {
                    File.Delete(downloadedZipPath);
                }

                throw;
            }
        }


        private async Task<string> GetLatestVersionUrl()
        {
            var latestVersion = await GetLatestVersion();
            return latestVersion.Url;
        }

        private void SetDefaultPreferences()
        {
            var pref = _preferenceRepository.FindByKey(Constants.Preferences.CollapseToTrayKey);
            if (pref == null)
            {
                SetCollapseToTray(true);
            }

            pref = _preferenceRepository.FindByKey(Constants.Preferences.DefaultAddonChannelKey);
            if (pref == null)
            {
                SetDefaultAddonChannel(AddonChannelType.Stable);
            }

            pref = _preferenceRepository.FindByKey(Constants.Preferences.WowUpReleaseChannelKey);
            if (pref == null)
            {
                SetWowUpReleaseChannel(GetDefaultReleaseChannel());
            }
        }

        private WowUpReleaseChannelType GetDefaultReleaseChannel() =>
            AppUtilities.IsBetaBuild
                ? WowUpReleaseChannelType.Beta
                : WowUpReleaseChannelType.Stable;

        private void SetPreference(string key, string value)
        {
            var pref = _preferenceRepository.FindByKey(key);
            if (pref == null)
            {
                pref = new Preference { Key = key };
            }

            pref.Value = value;

            _preferenceRepository.SaveItem(pref);

            PreferenceUpdated?.Invoke(this, new WowUpPreferenceEventArgs(pref));
        }

    }
}
