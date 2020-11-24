using Microsoft.Xaml.Behaviors.Media;
using Newtonsoft.Json;
using Serilog;
using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.IO;
using System.Linq;
using System.Reflection;
using System.Threading.Tasks;
using System.Windows.Documents;
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
        private const string UpdaterName = "WowUpUpdater.exe";
        private const string UpdateFileName = "WowUp.zip";
        private const string LatestVersionCacheKey = "latest-version-response";

        public const string WebsiteUrl = "https://wowup.io";

        private static readonly List<string> RescanRequiredVersions = new List<string>
        {
            "1.19.0"
        };

        private static string LocalAppDataPath => Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData);
        private static bool UpdaterExists => File.Exists(UpdaterPath);
        private static FileVersionInfo UpdaterVersion => FileUtilities.GetFileVersion(UpdaterPath);

        private readonly IAnalyticsService _analyticsService;
        private readonly ICacheService _cacheService;
        private readonly IDownloadService _downloadService;
        private readonly IPreferenceRepository _preferenceRepository;
        private readonly IWowUpApiService _wowUpApiService;

        /// <summary>
        /// The full path to the running exe file
        /// </summary>
        public static string ExecutablePath => Process.GetCurrentProcess().MainModule.FileName;

        /// <summary>
        /// Path to the working directory of the app
        /// </summary>
        public static string AppDataPath => Path.Combine(LocalAppDataPath, "WowUp");

        /// <summary>
        /// Path to the log folder inside the working directory
        /// </summary>
        public static string AppLogsPath => Path.Combine(AppDataPath, "Logs");

        /// <summary>
        /// Path to the download folder inside the working directory
        /// </summary>
        public static string DownloadPath => Path.Combine(AppDataPath, "Downloads");

        /// <summary>
        /// Path to the updater application inside the working directory
        /// </summary>
        public static string UpdaterPath => Path.Combine(AppDataPath, UpdaterName);

        public event WowUpPreferenceEventHandler PreferenceUpdated;

        public WowUpService(
            IAnalyticsService analyticsService,
            ICacheService cacheService,
            IDownloadService downloadService,
            IPreferenceRepository preferenceRepository,
            IWowUpApiService wowUpApiService)
        {
            _analyticsService = analyticsService;
            _cacheService = cacheService;
            _downloadService = downloadService;
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
            _analyticsService.TrackUserAction("WowUp", "CollapseToTray", enabled.ToString());
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

        public void SetClientDefaultAutoUpdate(WowClientType clientType, bool autoUpdate)
        {
            var preferenceKey = GetClientDefaultAutoUpdateKey(clientType);
            SetPreference(preferenceKey, autoUpdate.ToString());
            _analyticsService.TrackUserAction("WowUp", $"ClientDefaultAutoUpdate|{clientType}", autoUpdate.ToString());
        }

        public bool GetClientDefaultAutoUpdate(WowClientType clientType)
        {
            var preferenceKey = GetClientDefaultAutoUpdateKey(clientType);
            var preference = _preferenceRepository.FindByKey(preferenceKey);
            return bool.Parse(preference.Value);
        }

        public void SetClientAddonChannelType(WowClientType clientType, AddonChannelType channelType)
        {
            var preferenceKey = GetClientDefaultAddonChannelKey(clientType);
            SetPreference(preferenceKey, channelType.ToString());
            _analyticsService.TrackUserAction("WowUp", $"ClientDefaultChannel|{clientType}", channelType.ToString());
        }

        public AddonChannelType GetClientAddonChannelType(WowClientType clientType)
        {
            var preferenceKey = GetClientDefaultAddonChannelKey(clientType);
            var preference = _preferenceRepository.FindByKey(preferenceKey);
            return preference.Value.ToAddonChannelType();
        }

        public async Task<bool> IsUpdateAvailable()
        {
            var releaseChannel = GetWowUpReleaseChannel();
            var latestServerVersion = await GetLatestClientVersion();

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

            var processStartInfo = new ProcessStartInfo
            {
                FileName = UpdaterPath,
                Arguments = arguments,
                UseShellExecute = true
            };

            if (!FileUtilities.HasWriteAccess(AppUtilities.ApplicationFilePath) && Environment.OSVersion.Version.Major >= 6)
            {
                Log.Information("Running updater as admin");
                processStartInfo.Verb = "runas";
            }

            Process.Start(processStartInfo);

            AppUtilities.ShutdownApplication();
        }

        public async Task<LatestVersionResponse> GetLatestVersionResponse()
        {
            return await _cacheService.GetCache(LatestVersionCacheKey, async () =>
            {
                return await _wowUpApiService.GetLatestVersion();
            }, 60);
        }

        public async Task<LatestVersion> GetLatestClientVersion()
        {
            return await GetLatestClientVersion(GetWowUpReleaseChannel());
        }

        public async Task<LatestVersion> GetLatestClientVersion(WowUpReleaseChannelType releaseChannelType)
        {
            var response = await GetLatestVersionResponse();

            return releaseChannelType == WowUpReleaseChannelType.Stable
                ? response.Stable
                : response.Beta;
        }

        public async Task<ChangeLogFile> GetChangeLogFile()
        {
            try
            {
                var assembly = Assembly.GetExecutingAssembly();
                var resourceName = assembly.GetManifestResourceNames()
                    .First(str => str.EndsWith("changelog.json"));

                using Stream stream = assembly.GetManifestResourceStream(resourceName);
                using StreamReader reader = new StreamReader(stream);

                var result = await reader.ReadToEndAsync();
                return JsonConvert.DeserializeObject<ChangeLogFile>(result);
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
            var latestVersions = await GetLatestVersionResponse();
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
                var latestVersions = await GetLatestVersionResponse();

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
                var latestVersion = await GetLatestClientVersion();

                downloadedZipPath = await _downloadService.DownloadZipFile(
                        latestVersion.Url,
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

        public bool IsReScanRequired()
        {
            var matchedVersion = GetMatchingRescanVersion();

            if (string.IsNullOrEmpty(matchedVersion))
            {
                return false;
            }

            var versionPrefKey = GetReScanVersionKey(matchedVersion);

            var pref = _preferenceRepository.FindByKey(versionPrefKey);

            if(pref?.Value == true.ToString())
            {
                return false;
            }

            return true;
        }

        public void SetRequiredReScanCompleted()
        {
            var matchedVersion = GetMatchingRescanVersion();
            if (string.IsNullOrEmpty(matchedVersion))
            {
                return;
            }

            var versionPrefKey = GetReScanVersionKey(matchedVersion);
            SetPreference(versionPrefKey, true.ToString());
        }

        private string GetMatchingRescanVersion()
        {
            return RescanRequiredVersions
                .FirstOrDefault(ver => AppUtilities.CurrentVersionString.StartsWith(ver));
        }

        private string GetReScanVersionKey(string version)
        {
            return $"{version}_Rescan";
        }
        
        private string GetClientDefaultAddonChannelKey(WowClientType clientType)
        {
            return $"{clientType}{Constants.Preferences.ClientDefaultAddonChannelSuffix}".ToLower();
        }

        private string GetClientDefaultAutoUpdateKey(WowClientType clientType)
        {
            return $"{clientType}{Constants.Preferences.ClientDefaultAutoUpdateSuffix}".ToLower();
        }

        private void SetDefaultPreferences()
        {
            var pref = _preferenceRepository.FindByKey(Constants.Preferences.CollapseToTrayKey);
            if (pref == null)
            {
                SetCollapseToTray(true);
            }

            pref = _preferenceRepository.FindByKey(Constants.Preferences.WowUpReleaseChannelKey);
            if (pref == null)
            {
                SetWowUpReleaseChannel(GetDefaultReleaseChannel());
            }

            SetDefaultClientPreferences();
        }

        private void SetDefaultClientPreferences()
        {
            var clientTypes = Enum.GetValues(typeof(WowClientType))
                .Cast<WowClientType>()
                .Where(type => type != WowClientType.None)
                .ToList();

            foreach(var clientType in clientTypes)
            {
                var preferenceKey = GetClientDefaultAddonChannelKey(clientType);
                var preference = _preferenceRepository.FindByKey(preferenceKey);
                if(preference == null)
                {
                    SetClientAddonChannelType(clientType, AddonChannelType.Stable);
                }

                preferenceKey = GetClientDefaultAutoUpdateKey(clientType);
                preference = _preferenceRepository.FindByKey(preferenceKey);
                if (preference == null)
                {
                    SetClientDefaultAutoUpdate(clientType, false);
                }
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
