using Flurl.Http;
using Microsoft.Extensions.Caching.Memory;
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
using WowUp.WPF.AddonProviders.Contracts;
using WowUp.WPF.Entities;
using WowUp.WPF.Extensions;
using WowUp.WPF.Utilities;

namespace WowUp.WPF.AddonProviders
{
    public class WowInterfaceAddonProvider : IWowInterfaceAddonProvider
    {
        private const string ApiUrl = "https://api.mmoui.com/v4/game/WOW";
        private const string AddonUrl = "https://www.wowinterface.com/downloads/info";

        private readonly IMemoryCache _cache;

        public string Name => "WowInterface";

        public WowInterfaceAddonProvider(IMemoryCache memoryCache)
        {
            _cache = memoryCache;
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
            if(addon == null)
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
            if (_cache.TryGetValue(url, out var cachedResponse))
            {
                return cachedResponse as AddonDetailsResponse;
            }

            var results = await url
                .WithHeaders(HttpUtilities.DefaultHeaders)
                .GetJsonAsync<List<AddonDetailsResponse>>();

            var result = results.FirstOrDefault();

            _cache.CacheForAbsolute(url, result, TimeSpan.FromMinutes(60));

            return result;
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
                    GameVersion = string.Empty
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
                Log.Error(ex, $"GetAddonSearchResult {response.Id}");
                return default;
            }
        }

    }
}
