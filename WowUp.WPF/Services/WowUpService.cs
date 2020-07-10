using Flurl.Http;
using Microsoft.Extensions.Caching.Memory;
using Serilog;
using System;
using System.Linq;
using System.Threading.Tasks;
using WowUp.WPF.Extensions;
using WowUp.WPF.Models;
using WowUp.WPF.Services.Contracts;
using WowUp.WPF.Utilities;

namespace WowUp.WPF.Services
{
    public class WowUpService : IWowUpService
    {
        private const string ChangeLogUrl = "https://wowup-builds.s3.us-east-2.amazonaws.com/changelog/changelog.json";
        private const string LatestVersionUrlFormat = "https://wowup-builds.s3.us-east-2.amazonaws.com/v{0}/WowUp.zip";
        private const string ChangeLogFileCacheKey = "change_log_file";

        public const string WebsiteUrl = "https://wowup.io";

        private readonly IMemoryCache _cache;

        public WowUpService(IMemoryCache memoryCache)
        {
            _cache = memoryCache;
        }

        public void ShowLogsFolder()
        {
            FileUtilities.AppLogsPath.OpenUrlInBrowser();
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
    }
}
