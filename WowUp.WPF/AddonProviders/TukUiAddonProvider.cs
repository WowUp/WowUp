using Flurl;
using Flurl.Http;
using Polly;
using Polly.CircuitBreaker;
using Serilog;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using WowUp.Common.Enums;
using WowUp.Common.Extensions;
using WowUp.Common.Models;
using WowUp.Common.Models.Addons;
using WowUp.Common.Models.TukUi;
using WowUp.Common.Services.Contracts;
using WowUp.WPF.AddonProviders.Contracts;
using WowUp.WPF.Entities;
using WowUp.WPF.Models.WowUp;
using WowUp.WPF.Services.Contracts;
using WowUp.WPF.Utilities;

namespace WowUp.WPF.AddonProviders
{
    public class TukUiAddonProvider : ITukUiAddonProvider
    {
        private const string ApiUrl = "https://www.tukui.org/api.php";
        private const string ClientApiUrl = "https://www.tukui.org/client-api.php";
        private const int HttpTimeoutSeconds = 4;

        private readonly ICacheService _cacheService;
        private readonly IAnalyticsService _analyticsService;

        private readonly AsyncPolicy CircuitBreaker = Policy
            .Handle<FlurlHttpException>(ex =>
                ex.Call.Response.StatusCode != System.Net.HttpStatusCode.NotFound)
            .CircuitBreakerAsync(
                2,
                TimeSpan.FromMinutes(1),
                (ex, ts) => { Log.Error(ex, "TukUI CircuitBreaker broken"); },
                () => { Log.Information("TukUI CircuitBreaker reset"); });

        public string Name => "TukUI";

        public TukUiAddonProvider(
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
            var addons = await GetAllAddons(clientType);

            foreach (var addonFolder in addonFolders)
            {
                TukUiAddon addon = null;
                if (!string.IsNullOrEmpty(addonFolder.Toc.TukUiProjectId))
                {
                    addon = addons.FirstOrDefault(a => a.Id == addonFolder.Toc.TukUiProjectId);
                }
                else
                {
                    var results = await SearchAddons(clientType, addonFolder.Toc.Title);
                    addon = results.FirstOrDefault();
                }

                if (addon != null)
                {
                    addonFolder.MatchingAddon = new Addon
                    {
                        Author = addon.Author,
                        AutoUpdateEnabled = false,
                        ChannelType = addonChannelType,
                        ClientType = clientType,
                        DownloadUrl = addon.Url,
                        ExternalId = addon.Id,
                        ExternalUrl = addon.WebUrl,
                        FolderName = addonFolder.Name,
                        Name = addon.Name,
                        GameVersion = addon.Patch,
                        InstalledAt = DateTime.UtcNow,
                        InstalledFolders = addonFolder.Name,
                        InstalledVersion = addonFolder.Toc.Version,
                        IsIgnored = false,
                        LatestVersion = addon.Version,
                        ProviderName = Name,
                        ThumbnailUrl = addon.ScreenshotUrl
                    };
                }
            }
        }

        public bool IsValidAddonUri(Uri addonUri)
        {
            return false;
        }

        public async Task<AddonSearchResult> GetById(
            string addonId,
            WowClientType clientType)
        {
            var allAddons = await GetAllAddons(clientType);
            var match = allAddons.FirstOrDefault(a => a.Id == addonId);
            if (match == default(TukUiAddon))
            {
                return null;
            }

            return ToSearchResult(match, string.Empty);
        }

        public async Task<IEnumerable<PotentialAddon>> Search(string query, WowClientType clientType)
        {
            var addons = await GetAllAddons(clientType);
            var similarAddons = addons
                .Where(a => a.Name.Contains(query, StringComparison.OrdinalIgnoreCase))
                .OrderByDescending(a => a.Downloads);

            return similarAddons.Select(ToPotentialAddon);
        }

        public Task<PotentialAddon> Search(Uri addonUri, WowClientType clientType)
        {
            throw new NotImplementedException();
        }

        public async Task<IList<PotentialAddon>> GetFeaturedAddons(WowClientType clientType)
        {
            var addons = await GetAllAddons(clientType);
            return addons.Select(addon => ToPotentialAddon(addon))
                .OrderByDescending(addon => addon.DownloadCount)
                .Take(20)
                .ToList();
        }

        public async Task<IList<AddonSearchResult>> GetAll(WowClientType clientType, IEnumerable<string> addonIds)
        {
            var results = new List<AddonSearchResult>();

            try
            {
                var addons = await GetAllAddons(clientType);
                results = addons
                    .Where(a => addonIds.Any(aid => aid == a.Id))
                    .Select(a => ToSearchResult(a, string.Empty))
                    .ToList();
            }
            catch (Exception ex)
            {
                _analyticsService.Track(ex, "Failed to search TukUi");
            }

            return results;
        }

        public void OnPostInstall(Addon addon)
        {
        }

        public async Task<IEnumerable<AddonSearchResult>> Search(string addonName, string folderName, WowClientType clientType, string nameOverride = null)
        {
            var results = new List<AddonSearchResult>();
            try
            {
                var addons = await SearchAddons(clientType, addonName);
                var addon = addons.FirstOrDefault();

                if (addon != null)
                {
                    results.Add(ToSearchResult(addon, folderName));
                }
            }
            catch (Exception ex)
            {
                _analyticsService.Track(ex, "Failed to search TukUi");
            }

            return results;
        }

        private async Task<List<TukUiAddon>> SearchAddons(WowClientType clientType, string addonName)
        {
            var addons = await GetAllAddons(clientType);
            return addons
                .Where(a => a.Name.Equals(addonName, StringComparison.OrdinalIgnoreCase))
                .ToList();
        }

        private PotentialAddon ToPotentialAddon(TukUiAddon addon)
        {
            return new PotentialAddon
            {
                Author = addon.Author,
                DownloadCount = int.Parse(addon.Downloads),
                ExternalId = addon.Id,
                ExternalUrl = addon.WebUrl,
                Name = addon.Name,
                ProviderName = Name,
                ThumbnailUrl = addon.ScreenshotUrl
            };
        }

        private AddonSearchResult ToSearchResult(TukUiAddon addon, string folderName)
        {
            var latestFile = new AddonSearchResultFile
            {
                ChannelType = AddonChannelType.Stable,
                Folders = new[] { folderName },
                DownloadUrl = addon.Url,
                GameVersion = addon.Patch,
                Version = addon.Version,
                ReleaseDate = addon.LastUpdate,
                Dependencies = Enumerable.Empty<AddonSearchResultDependency>()
            };

            return new AddonSearchResult
            {
                Author = addon.Author,
                ExternalId = addon.Id,
                Name = addon.Name,
                ThumbnailUrl = addon.ScreenshotUrl,
                ExternalUrl = addon.WebUrl,
                ProviderName = Name,
                Files = new[] { latestFile }
            };
        }

        private async Task<IEnumerable<TukUiAddon>> GetAllAddons(WowClientType clientType)
        {
            var cacheKey = GetCacheKey(clientType);

            var results = await _cacheService.GetCache(cacheKey, async () =>
            {
                try
                {
                    var query = GetAddonsSuffix(clientType);

                    var result = await CircuitBreaker.ExecuteAsync(async () =>
                        await ApiUrl
                            .SetQueryParam(query, "all")
                            .WithTimeout(HttpTimeoutSeconds)
                            .WithHeaders(HttpUtilities.DefaultHeaders)
                            .GetJsonAsync<List<TukUiAddon>>());

                    if (clientType.IsRetail())
                    {
                        result.Add(await GetTukUiRetailAddon());
                        result.Add(await GetElvUiRetailAddon());
                    }

                    return result;
                }
                catch (Exception ex)
                {
                    Log.Error(ex, "Failed to get all addons");
                    throw;
                }
            }, 5);

            return results ?? new List<TukUiAddon>();
        }

        private async Task<TukUiAddon> GetClientApiAddon(string addonName)
        {
            return await CircuitBreaker.ExecuteAsync(async () => await ClientApiUrl
                .SetQueryParam("ui", addonName)
                .WithTimeout(HttpTimeoutSeconds)
                .WithHeaders(HttpUtilities.DefaultHeaders)
                .GetJsonAsync<TukUiAddon>());
        }

        private async Task<TukUiAddon> GetElvUiRetailAddon()
        {
            return await GetClientApiAddon("elvui");
        }

        private async Task<TukUiAddon> GetTukUiRetailAddon()
        {
            return await GetClientApiAddon("tukui");
        }

        private string GetCacheKey(WowClientType clientType)
        {
            switch (clientType)
            {
                case WowClientType.Classic:
                case WowClientType.ClassicPtr:
                    return "tukui_classic_addons";
                case WowClientType.Retail:
                case WowClientType.RetailPtr:
                case WowClientType.Beta:
                    return "tukui_addons";
                default:
                    return string.Empty;
            }
        }

        private string GetAddonsSuffix(WowClientType clientType)
        {
            switch (clientType)
            {
                case WowClientType.Classic:
                case WowClientType.ClassicPtr:
                    return "classic-addons";
                case WowClientType.Retail:
                case WowClientType.RetailPtr:
                case WowClientType.Beta:
                    return "addons";
                default:
                    return string.Empty;
            }
        }


    }
}
