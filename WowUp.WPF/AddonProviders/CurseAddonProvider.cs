using Flurl;
using Flurl.Http;
using Polly;
using Serilog;
using System;
using System.Collections.Concurrent;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using WowUp.Common.Enums;
using WowUp.Common.Models;
using WowUp.Common.Models.Addons;
using WowUp.Common.Models.Curse;
using WowUp.Common.Services.Contracts;
using WowUp.WPF.AddonProviders.Contracts;
using WowUp.WPF.AddonProviders.Curse;
using WowUp.WPF.Entities;
using WowUp.WPF.Extensions;
using WowUp.WPF.Models.Curse;
using WowUp.WPF.Models.WowUp;
using WowUp.WPF.Services.Contracts;
using WowUp.WPF.Utilities;

namespace WowUp.WPF.AddonProviders
{
    public class CurseAddonProvider : ICurseAddonProvider
    {
        private const string ApiUrl = "https://addons-ecs.forgesvc.net/api/v2";
        private const string HubApiUrl = "https://hub.wowup.io";
        private const string ClassicGameVersionFlavor = "wow_classic";
        private const string RetailGameVersionFlavor = "wow_retail";
        private const int HttpTimeoutSeconds = 10;

        private readonly ICacheService _cacheService;
        private readonly IAnalyticsService _analyticsService;

        private readonly AsyncPolicy CircuitBreaker = Policy
            .Handle<FlurlHttpException>(ex =>
                ex.Call.Response.StatusCode != System.Net.HttpStatusCode.NotFound)
            .CircuitBreakerAsync(
                2,
                TimeSpan.FromMinutes(1),
                (ex, ts) => { Log.Error(ex, "Curse CircuitBreaker broken"); },
                () => { Log.Information("Curse CircuitBreaker reset"); });

        public string Name => "Curse";

        public CurseAddonProvider(
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
            var addonDirectory = addonFolders.FirstOrDefault()?.Directory.Parent.FullName;
            var scanResults = await GetScanResults(addonFolders);

            await MapAddonFolders(scanResults, clientType);

            var addonIds = scanResults
                .Where(sr => sr.ExactMatch != null)
                .Select(sr => sr.ExactMatch.Id.ToString())
                .Distinct();

            //var addonIdStr = string.Join(",", addonIds);

            var addonResults = await GetAllIds(addonIds);

            foreach (var addonFolder in addonFolders)
            {
                var scanResult = scanResults.First(sr => sr.AddonFolder.Name == addonFolder.Name);
                if (scanResult.ExactMatch == null)
                {
                    continue;
                }

                scanResult.SearchResult = addonResults.FirstOrDefault(ar => ar.Id == scanResult.ExactMatch.Id);
                if (scanResult.SearchResult == null)
                {
                    continue;
                }

                try
                {
                    addonFolder.MatchingAddon = GetAddon(clientType, addonChannelType, scanResult);
                }
                catch (Exception ex)
                {
                    _analyticsService.Track(ex, $"Failed to create addon for result {scanResult.FolderScanner.Fingerprint}");
                }
            }
        }

        public bool IsValidAddonUri(Uri addonUri)
        {
            return string.IsNullOrEmpty(addonUri.Host) == false &&
                addonUri.Host.EndsWith("curseforge.com") &&
                addonUri.LocalPath.StartsWith("/wow/addons");
        }

        public async Task<AddonSearchResult> GetById(
            string addonId,
            WowClientType clientType)
        {
            var result = await GetSearchResult(addonId);
            if (result == null)
            {
                return null;
            }

            var latestFiles = GetLatestFiles(result, clientType);
            if (!latestFiles.Any())
            {
                return null;
            }

            return GetAddonSearchResult(result, latestFiles);
        }

        public async Task<CurseSearchResult> GetSearchResult(string addonId)
        {
            var url = $"{ApiUrl}/addon/{addonId}";

            return await _cacheService.GetCache(url, async () =>
            {
                return await CircuitBreaker.ExecuteAsync(async () => await url
                    .WithHeaders(HttpUtilities.DefaultHeaders)
                    .WithTimeout(HttpTimeoutSeconds)
                    .GetJsonAsync<CurseSearchResult>());
            }, 5);
        }

        public async Task<IEnumerable<PotentialAddon>> Search(string query, WowClientType clientType)
        {
            var searchResults = new List<PotentialAddon>();

            var response = await GetSearchResults(query);
            foreach (var result in response)
            {
                var latestFiles = GetLatestFiles(result, clientType);
                if (!latestFiles.Any())
                {
                    continue;
                }

                searchResults.Add(GetPotentialAddon(result));
            }

            return searchResults;
        }

        /// <summary>
        /// This is a basic method, curse api does not search via slug, so you have to get lucky basically.
        /// Could pre-make a map for slug to addon if wanted.
        /// </summary>
        /// <param name="addonUri"></param>
        /// <param name="clientType"></param>
        /// <returns></returns>
        public async Task<PotentialAddon> Search(Uri addonUri, WowClientType clientType)
        {
            var addonSlug = addonUri.LocalPath.Split('/').Last();
            var response = await GetSearchResults(addonSlug);
            var result = response.FirstOrDefault(res => res.Slug == addonSlug);
            if (result == null)
            {
                return null;
            }

            var latestFiles = GetLatestFiles(result, clientType);
            if (!latestFiles.Any())
            {
                return null;
            }

            return GetPotentialAddon(result);
        }

        public async Task<IEnumerable<AddonSearchResult>> Search(
            string addonName,
            string folderName,
            WowClientType clientType,
            string nameOverride = null)
        {
            var results = new List<AddonSearchResult>();

            var matches = await Search(addonName, folderName, clientType);

            foreach (var match in matches)
            {
                var latestFiles = GetLatestFiles(match, clientType);
                var searchResult = GetAddonSearchResult(match, latestFiles);
                if (searchResult != null)
                {
                    results.Add(searchResult);
                }
            }

            return results;
        }

        private async Task<List<CurseSearchResult>> Search(
            string addonName,
            string folderName,
            WowClientType clientType)
        {
            var response = await GetSearchResults(addonName);
            var matches = FilterResults(response, addonName, folderName, clientType);

            return matches.Where(m => GetLatestFiles(m, clientType).Any()).ToList();
        }

        public async Task<IList<AddonSearchResult>> GetAll(WowClientType clientType, IEnumerable<string> addonIds)
        {
            var addonResults = new List<AddonSearchResult>();
            if (!addonIds.Any())
            {
                return addonResults;
            }

            var results = await GetAllIds(addonIds);

            foreach (var result in results)
            {
                var latestFiles = GetLatestFiles(result, clientType);
                if (!latestFiles.Any())
                {
                    continue;
                }

                var searchResult = GetAddonSearchResult(result, latestFiles);
                if (searchResult != null)
                {
                    addonResults.Add(searchResult);
                }
            }

            return addonResults;
        }

        public async Task<IList<PotentialAddon>> GetFeaturedAddons(WowClientType clientType)
        {
            var featured = await GetFeaturedAddonList();

            featured = FilterClientType(featured, clientType);

            return featured.Select(f => GetPotentialAddon(f)).ToList();
        }

        public void OnPostInstall(Addon addon)
        {
        }

        public async Task<List<CurseScanResult>> GetScanResults(IEnumerable<AddonFolder> addonFolders)
        {
            var scanResults = new ConcurrentBag<CurseScanResult>();
            await addonFolders.ForEachAsync(3, async addonFolder =>
            {
                var scanner = await new CurseFolderScanner(addonFolder.Directory).ScanFolder();

                var scanResult = new CurseScanResult
                {
                    FolderScanner = scanner,
                    AddonFolder = addonFolder
                };

                scanResults.Add(scanResult);
            });

            return scanResults.ToList();
        }

        private IEnumerable<CurseDependency> GetRequiredDependencies(CurseFile file)
        {
            return file.Dependencies
                    .Where(dep => dep.Type.AsAddonDependencyType() == AddonDependencyType.Required);
        }

        private Addon GetAddon(
            WowClientType clientType,
            AddonChannelType addonChannelType,
            CurseScanResult scanResult)
        {
            var currentVersion = scanResult.ExactMatch.File;
            var authors = string.Join(", ", scanResult.SearchResult.Authors.Select(author => author.Name));
            var folderList = string.Join(",", scanResult.ExactMatch.File.Modules.Select(m => m.Foldername));
            var latestVersion = GetLatestFiles(scanResult.SearchResult, clientType).First();

            return new Addon
            {
                Author = string.Join(", ", scanResult.SearchResult.Authors.Select(author => author.Name)),
                Name = scanResult.SearchResult.Name,
                ChannelType = addonChannelType,
                AutoUpdateEnabled = false,
                ClientType = clientType,
                DownloadUrl = latestVersion.DownloadUrl,
                ExternalUrl = scanResult.SearchResult.WebsiteUrl,
                ExternalId = scanResult.SearchResult.Id.ToString(),
                FolderName = scanResult.AddonFolder.Name,
                GameVersion = currentVersion.GameVersion.FirstOrDefault(),
                InstalledAt = DateTime.Now,
                InstalledFolders = folderList,
                InstalledVersion = currentVersion.FileName,
                IsIgnored = false,
                LatestVersion = latestVersion.FileName,
                ProviderName = Name,
                ThumbnailUrl = GetThumbnailUrl(scanResult.SearchResult)
            };
        }

        private async Task MapAddonFolders(List<CurseScanResult> scanResults, WowClientType clientType)
        {
            var fingerprints = scanResults.Select(sf => sf.FolderScanner.Fingerprint);

            try
            {
                var fingerprintResponse = await GetAddonsByFingerprintsW(fingerprints);

                foreach (var scanResult in scanResults)
                {
                    // Curse can deliver the wrong result sometimes, ensure the result matches the client type
                    scanResult.ExactMatch = fingerprintResponse.ExactMatches
                        .FirstOrDefault(exactMatch =>
                            exactMatch.File != null &&
                            IsClientType(exactMatch.File.GameVersionFlavor, clientType) &&
                            HasMatchingFingerprint(scanResult, exactMatch));

                    // If the addon does not have an exact match, check the partial matches.
                    if (scanResult.ExactMatch == null && fingerprintResponse.PartialMatches != null)
                    {
                        scanResult.ExactMatch = fingerprintResponse.PartialMatches
                            .FirstOrDefault(partialMatch =>
                                IsClientType(partialMatch.File.GameVersionFlavor, clientType) &&
                                (partialMatch.File?.Modules?.Any(module => module.Fingerprint == scanResult.FolderScanner.Fingerprint)
                                ?? false));
                    }
                }
            }
            catch (Exception ex)
            {
                Log.Error(ex, "Failed to map addon folders");
                Log.Error($"Fingerprints\n{string.Join(",", fingerprints)}");
                throw;
            }
        }

        private bool HasMatchingFingerprint(CurseScanResult scanResult, CurseMatch exactMatch)
        {
            return exactMatch.File.Modules.Any(m => m.Fingerprint == scanResult.FolderScanner.Fingerprint);
        }

        private IList<CurseSearchResult> FilterClientType(IEnumerable<CurseSearchResult> results, WowClientType clientType)
        {
            var clientTypeStr = GetClientTypeString(clientType);

            return results
                .Where(r => r.LatestFiles.Any(f => DoesFileMatchClientType(f, clientTypeStr)))
                .ToList();
        }

        private bool DoesFileMatchClientType(CurseFile file, string clientTypeStr)
        {
            return file.ReleaseType == CurseReleaseType.Release &&
                file.GameVersionFlavor == clientTypeStr &&
                file.IsAlternate == false;
        }

        private AddonChannelType GetChannelType(CurseReleaseType releaseType)
        {
            return releaseType switch
            {
                CurseReleaseType.Alpha => AddonChannelType.Alpha,
                CurseReleaseType.Beta => AddonChannelType.Beta,
                _ => AddonChannelType.Stable,
            };
        }

        private AddonSearchResult GetAddonSearchResult(CurseSearchResult result, IEnumerable<CurseFile> latestFiles)
        {
            try
            {
                var thumbnailUrl = GetThumbnailUrl(result);
                var id = result.Id;
                var name = result.Name;
                var author = GetAuthor(result);

                var searchResultFiles = latestFiles.Select(lf => new AddonSearchResultFile
                {
                    ChannelType = GetChannelType(lf.ReleaseType),
                    Version = lf.FileName,
                    DownloadUrl = lf.DownloadUrl,
                    Folders = GetFolderNames(lf),
                    GameVersion = GetGameVersion(lf),
                    ReleaseDate = lf.FileDate,
                    Dependencies = lf.Dependencies != null ? 
                        lf.Dependencies.Select(dep => new AddonSearchResultDependency
                        {
                            AddonId = dep.AddonId,
                            Type = dep.Type.AsAddonDependencyType()
                        }) : Enumerable.Empty<AddonSearchResultDependency>()
                });

                return new AddonSearchResult
                {
                    Author = author,
                    ExternalId = id.ToString(),
                    Name = name,
                    ThumbnailUrl = thumbnailUrl,
                    ExternalUrl = result.WebsiteUrl,
                    ProviderName = Name,
                    Files = searchResultFiles
                };
            }
            catch (Exception ex)
            {
                _analyticsService.Track(ex, "GetAddonSearchResult");
                return null;
            }
        }

        private IList<CurseSearchResult> FilterResults(
            IList<CurseSearchResult> results,
            string addonName,
            string folderName,
            WowClientType clientType)
        {
            var clientTypeStr = GetClientTypeString(clientType);

            return results.
                Where(r =>
                    r.Name == addonName ||
                    r.LatestFiles.Any(f => f.ReleaseType == CurseReleaseType.Release &&
                        f.GameVersionFlavor == clientTypeStr &&
                        f.IsAlternate == false &&
                        f.Modules.Any(m => m.Foldername == folderName)))
                .ToList();
        }

        private IList<string> GetFolderNames(CurseFile file)
        {
            return file.Modules.Select(m => m.Foldername).ToList();
        }

        private string GetAuthor(CurseSearchResult result)
        {
            var authorNames = result.Authors.Select(a => a.Name);
            return string.Join(", ", authorNames);
        }

        private string GetGameVersion(CurseFile file)
        {
            return file.GameVersion.FirstOrDefault();
        }

        private IEnumerable<CurseFile> GetLatestFiles(CurseSearchResult result, WowClientType clientType)
        {
            var clientTypeStr = GetClientTypeString(clientType);

            return result.LatestFiles
                .Where(f => f.IsAlternate == false && f.GameVersionFlavor == clientTypeStr)
                .OrderByDescending(f => f.Id);
        }

        private string GetThumbnailUrl(CurseSearchResult result)
        {
            return result.Attachments
                .FirstOrDefault(f => f.IsDefault && !string.IsNullOrEmpty(f.ThumbnailUrl))?.ThumbnailUrl;
        }

        private async Task<IList<CurseSearchResult>> GetAllIds(IEnumerable<string> addonIds)
        {
            var url = $"{ApiUrl}/addon";

            try
            {
                return await CircuitBreaker.ExecuteAsync(async () => await url
                    .WithHeaders(HttpUtilities.DefaultHeaders)
                    .WithTimeout(HttpTimeoutSeconds)
                    .PostJsonAsync(addonIds.Select(id => Convert.ToInt32(id)).ToArray())
                    .ReceiveJson<List<CurseSearchResult>>());
            }
            catch (Exception ex)
            {
                _analyticsService.Track(ex, "GetAllIds");

                return new List<CurseSearchResult>();
            }
        }

        private async Task<IList<CurseSearchResult>> GetSearchResults(string query)
        {
            var url = $"{ApiUrl}/addon/search";

            try
            {
                return await CircuitBreaker.ExecuteAsync(async () => await url
                    .SetQueryParams(new { gameId = 1, searchFilter = query })
                    .WithTimeout(HttpTimeoutSeconds)
                    .WithHeaders(HttpUtilities.DefaultHeaders)
                    .GetJsonAsync<IList<CurseSearchResult>>());
            }
            catch (Exception ex)
            {
                _analyticsService.Track(ex, "GetSearchResults");

                return new List<CurseSearchResult>();
            }
        }

        private async Task<IList<CurseSearchResult>> GetFeaturedAddonList()
        {
            var url = $"{ApiUrl}/addon/featured";

            try
            {
                var body = new
                {
                    GameId = 1,
                    featuredCount = 6,
                    popularCount = 50,
                    updatedCount = 0
                };

                var response = await _cacheService.GetCache(url, async () =>
                {
                    return await CircuitBreaker.ExecuteAsync(async () => await url
                        .WithHeaders(HttpUtilities.DefaultHeaders)
                        .WithTimeout(HttpTimeoutSeconds)
                        .PostJsonAsync(body)
                        .ReceiveJson<CurseGetFeaturedResponse>());
                }, 5);

                return response.Popular.ToList();
            }
            catch (Exception ex)
            {
                _analyticsService.Track(ex, "GetSearchResults");
                return new List<CurseSearchResult>();
            }
        }

        private async Task<CurseFingerprintsResponse> GetAddonsByFingerprintsW(IEnumerable<long> fingerprints)
        {
            var url = $"{HubApiUrl}/curseforge/addons/fingerprint";

            Log.Information($"Wowup Fetching fingerprints {string.Join(',', fingerprints)}");

            return await CircuitBreaker.ExecuteAsync(async () => await url
                .WithHeaders(HttpUtilities.DefaultHeaders)
                .WithTimeout(HttpTimeoutSeconds)
                .PostJsonAsync(new
                {
                    fingerprints
                })
                .ReceiveJson<CurseFingerprintsResponse>());
        }

        private async Task<CurseFingerprintsResponse> GetAddonsByFingerprints(IEnumerable<long> fingerprints)
        {
            var url = $"{ApiUrl}/fingerprint";

            return await CircuitBreaker.ExecuteAsync(async () => await url
                .WithHeaders(HttpUtilities.DefaultHeaders)
                .WithTimeout(HttpTimeoutSeconds)
                .PostJsonAsync(fingerprints)
                .ReceiveJson<CurseFingerprintsResponse>());
        }

        private PotentialAddon GetPotentialAddon(CurseSearchResult searchResult)
        {
            return new PotentialAddon
            {
                ProviderName = Name,
                Name = searchResult.Name,
                DownloadCount = (int)searchResult.DownloadCount,
                ThumbnailUrl = GetThumbnailUrl(searchResult),
                ExternalId = searchResult.Id.ToString(),
                ExternalUrl = searchResult.WebsiteUrl,
                Author = GetAuthor(searchResult)
            };
        }

        private bool IsClientType(string gameVesionFlavor, WowClientType clientType)
        {
            switch (clientType)
            {
                case WowClientType.Classic:
                case WowClientType.ClassicPtr:
                    return ClassicGameVersionFlavor == gameVesionFlavor;
                case WowClientType.Retail:
                case WowClientType.RetailPtr:
                case WowClientType.Beta:
                    return RetailGameVersionFlavor == gameVesionFlavor;
                default:
                    return false;
            }
        }

        private string GetClientTypeString(WowClientType clientType)
        {
            switch (clientType)
            {
                case WowClientType.Classic:
                case WowClientType.ClassicPtr:
                    return ClassicGameVersionFlavor;
                case WowClientType.Retail:
                case WowClientType.RetailPtr:
                case WowClientType.Beta:
                    return RetailGameVersionFlavor;
                default:
                    return string.Empty;
            }
        }
    }
}
