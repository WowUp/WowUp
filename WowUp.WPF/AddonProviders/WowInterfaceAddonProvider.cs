using Flurl.Http;
using Polly;
using Serilog;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Text.RegularExpressions;
using System.Threading.Tasks;
using WowUp.Common.Enums;
using WowUp.Common.Models;
using WowUp.Common.Models.Addons;
using WowUp.Common.Models.WowInterface;
using WowUp.Common.Services.Contracts;
using WowUp.WPF.AddonProviders.Contracts;
using WowUp.WPF.Entities;
using WowUp.WPF.Models.WowUp;
using WowUp.WPF.Services.Contracts;
using WowUp.WPF.Utilities;

namespace WowUp.WPF.AddonProviders
{
    public class WowInterfaceAddonProvider : IWowInterfaceAddonProvider
    {
        private const string ApiUrl = "https://api.mmoui.com/v4/game/WOW";
        private const string AddonUrl = "https://www.wowinterface.com/downloads/info";
        private const int HttpTimeoutSeconds = 4;

        private readonly IAnalyticsService _analyticsService;
        private readonly ICacheService _cacheService;

        private readonly AsyncPolicy CircuitBreaker = Policy
            .Handle<FlurlHttpException>(ex =>
                ex.Call.Response.StatusCode != System.Net.HttpStatusCode.NotFound)
            .CircuitBreakerAsync(
                2,
                TimeSpan.FromMinutes(1),
                (ex, ts) => { Log.Error(ex, "WowInterface CircuitBreaker broken"); },
                () => { Log.Information("WowInterface CircuitBreaker reset"); });

        public string Name => "WowInterface";

        public WowInterfaceAddonProvider(
            IAnalyticsService analyticsService,
            ICacheService cacheService)
        {
            _analyticsService = analyticsService;
            _cacheService = cacheService;
        }

        public async Task Scan(
            WowClientType clientType,
            AddonChannelType addonChannelType,
            IEnumerable<AddonFolder> addonFolders)
        {
            Log.Debug($"{Name} Scanning {addonFolders.Count()} addons");
            foreach (var addonFolder in addonFolders)
            {
                if (string.IsNullOrEmpty(addonFolder.Toc.WowInterfaceId))
                {
                    continue;
                }

                var details = await GetAddonDetails(addonFolder.Toc.WowInterfaceId);
                addonFolder.MatchingAddon = new Addon
                {
                    Author = details.Author,
                    AutoUpdateEnabled = false,
                    ChannelType = addonChannelType,
                    ClientType = clientType,
                    DownloadUrl = details.DownloadUri,
                    ExternalId = details.Id.ToString(),
                    ExternalUrl = GetAddonUrl(details),
                    FolderName = addonFolder.Name,
                    GameVersion = string.Empty,
                    InstalledAt = DateTime.UtcNow,
                    InstalledFolders = addonFolder.Name,
                    InstalledVersion = addonFolder.Toc.Version,
                    IsIgnored = false,
                    LatestVersion = details.Version,
                    Name = details.Title,
                    ProviderName = Name,
                    ThumbnailUrl = GetThumbnailUrl(details)
                };
            }
        }

        public async Task<IList<AddonSearchResult>> GetAll(WowClientType clientType, IEnumerable<string> addonIds)
        {
            var searchResults = new List<AddonSearchResult>();

            foreach (var addonId in addonIds)
            {
                var result = await GetById(addonId, clientType);
                if (result == null)
                {
                    continue;
                }

                searchResults.Add(result);
            }

            return searchResults;
        }

        public async Task<AddonSearchResult> GetById(string addonId, WowClientType clientType)
        {
            var result = await GetAddonDetails(addonId);

            if (result == null)
            {
                return default;
            }

            return ToAddonSearchResult(result, string.Empty);
        }

        public Task<IList<PotentialAddon>> GetFeaturedAddons(WowClientType clientType)
        {
            return Task.FromResult(new List<PotentialAddon>() as IList<PotentialAddon>);
        }

        public bool IsValidAddonUri(Uri addonUri)
        {
            return !string.IsNullOrEmpty(addonUri.Host) &&
                addonUri.Host.EndsWith("wowinterface.com");
        }

        public void OnPostInstall(Addon addon)
        {
            throw new NotImplementedException();
        }

        public Task<IEnumerable<PotentialAddon>> Search(string query, WowClientType clientType)
        {
            return Task.FromResult(new List<PotentialAddon>() as IEnumerable<PotentialAddon>);
        }

        public async Task<PotentialAddon> Search(Uri addonUri, WowClientType clientType)
        {
            var addonId = GetAddonId(addonUri);
            if (string.IsNullOrEmpty(addonId))
            {
                throw new Exception($"Addon ID not found {addonUri}");
            }

            var addon = await GetAddonDetails(addonId);
            if (addon == null)
            {
                throw new Exception($"Bad addon api response {addonUri}");
            }

            return ToPotentialAddon(addon);
        }

        public Task<IEnumerable<AddonSearchResult>> Search(string addonName, string folderName, WowClientType clientType, string nameOverride = null)
        {
            return Task.FromResult(new List<AddonSearchResult>() as IEnumerable<AddonSearchResult>);
        }

        private async Task<AddonDetailsResponse> GetAddonDetails(string addonId)
        {
            var url = $"{ApiUrl}/filedetails/{addonId}.json";

            return await _cacheService.GetCache(url, async () =>
            {
                var results = await CircuitBreaker.ExecuteAsync(async () => await url
                   .WithHeaders(HttpUtilities.DefaultHeaders)
                   .WithTimeout(HttpTimeoutSeconds)
                   .GetJsonAsync<List<AddonDetailsResponse>>());

                return results.FirstOrDefault();
            }, 5);
        }

        private string GetAddonId(Uri addonUri)
        {
            var regex = new Regex(@"\/info(\d+)");
            var match = regex.Match(addonUri.LocalPath);
            if (!match.Success)
            {
                return string.Empty;
            }

            return match.Groups[1].Value;
        }

        private string GetThumbnailUrl(AddonDetailsResponse response)
        {
            return response.Images?.FirstOrDefault()?.ThumbUrl;
        }

        private string GetAddonUrl(AddonDetailsResponse response)
        {
            return $"{AddonUrl}{response.Id}";
        }

        private PotentialAddon ToPotentialAddon(AddonDetailsResponse response)
        {
            return new PotentialAddon
            {
                ProviderName = Name,
                Name = response.Title,
                DownloadCount = (int)response.Downloads,
                ThumbnailUrl = GetThumbnailUrl(response),
                ExternalId = response.Id.ToString(),
                ExternalUrl = GetAddonUrl(response),
                Author = response.Author
            };
        }

        private AddonSearchResult ToAddonSearchResult(AddonDetailsResponse response, string folderName)
        {
            try
            {
                var searchResultFile = new AddonSearchResultFile
                {
                    ChannelType = AddonChannelType.Stable,
                    Version = response.Version,
                    DownloadUrl = response.DownloadUri,
                    Folders = new[] { folderName },
                    GameVersion = string.Empty,
                    ReleaseDate = DateTime.UtcNow,
                    Dependencies = Enumerable.Empty<AddonSearchResultDependency>()
                };

                return new AddonSearchResult
                {
                    Author = response.Author,
                    ExternalId = response.Id.ToString(),
                    Name = response.Title,
                    ThumbnailUrl = GetThumbnailUrl(response),
                    ExternalUrl = GetAddonUrl(response),
                    ProviderName = Name,
                    Files = new[] { searchResultFile }
                };
            }
            catch (Exception ex)
            {
                _analyticsService.Track(ex, $"GetAddonSearchResult {response.Id}");
                return default;
            }
        }

    }
}
