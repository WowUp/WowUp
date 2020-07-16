using Flurl;
using Flurl.Http;
using Serilog;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using WowUp.Common.Enums;
using WowUp.WPF.AddonProviders.Contracts;
using WowUp.WPF.Models;
using WowUp.WPF.Models.Curse;

namespace WowUp.WPF.AddonProviders
{
    public class CurseAddonProvider : IAddonProvider
    {
        private const string ApiUrl = "https://addons-ecs.forgesvc.net/api/v2";

        public string Name => "Curse";

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
            var url = $"{ApiUrl}/addon/{addonId}";

            var result = await url.GetJsonAsync<CurseSearchResult>();
            if (result == null)
            {
                return null;
            }

            var latestFile = GetLatestFile(result, clientType);
            if (latestFile == null)
            {
                return null;
            }

            return GetAddonSearchResult(result, latestFile);
        }

        /// <summary>
        /// This is a basic method, curse api does not search via slug, so you have to get lucky basically.
        /// Could pre-make a map for slug to addon if wanted.
        /// </summary>
        /// <param name="addonUri"></param>
        /// <param name="clientType"></param>
        /// <returns></returns>
        public async Task<AddonSearchResult> Search(Uri addonUri, WowClientType clientType)
        {
            var addonSlug = addonUri.LocalPath.Split('/').Last();
            var response = await GetSearchResults(addonSlug);
            var result = response.FirstOrDefault(res => res.Slug == addonSlug);
            if (result == null)
            {
                return null;
            }

            var latestFile = GetLatestFile(result, clientType);
            if (latestFile == null)
            {
                return null;
            }

            return GetAddonSearchResult(result, latestFile);
        }

        public async Task<IEnumerable<AddonSearchResult>> Search(
            string addonName,
            string folderName,
            WowClientType clientType,
            string nameOverride = null)
        {
            var results = new List<AddonSearchResult>();

            var response = await GetSearchResults(nameOverride ?? addonName);

            var matches = FilterResults(response, addonName, folderName, clientType);

            foreach (var match in matches)
            {
                var latestFile = GetLatestFile(match, clientType);
                if (latestFile == null)
                {
                    continue;
                }

                var searchResult = GetAddonSearchResult(match, latestFile);
                if (searchResult != null)
                {
                    results.Add(searchResult);
                }
            }

            return results;
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
                var latestFile = GetLatestFile(result, clientType);
                if (latestFile == null)
                {
                    continue;
                }

                var searchResult = GetAddonSearchResult(result, latestFile);
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

        private AddonSearchResult GetAddonSearchResult(CurseSearchResult result, CurseFile latestFile)
        {
            try
            {
                var thumbnailUrl = GetThumbnailUrl(result);
                var id = result.Id;
                var name = result.Name;
                var fileName = latestFile.FileName;
                var folders = GetFolderNames(latestFile);
                var gameVersion = GetGameVersion(latestFile);
                var author = GetAuthor(result);
                var downloadUrl = latestFile.DownloadUrl;

                return new AddonSearchResult
                {
                    Author = author,
                    ExternalId = id.ToString(),
                    Folders = folders,
                    GameVersion = gameVersion,
                    Name = name,
                    ThumbnailUrl = thumbnailUrl,
                    Version = fileName,
                    DownloadUrl = downloadUrl,
                    ExternalUrl = result.WebsiteUrl,
                    ProviderName = Name
                };
            }
            catch (Exception ex)
            {
                Log.Error(ex, "GetAddonSearchResult");
                Console.WriteLine(ex);
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

        private CurseFile GetLatestFile(CurseSearchResult result, WowClientType clientType)
        {
            var clientTypeStr = GetClientTypeString(clientType);

            return result.LatestFiles
                .Where(f => f.IsAlternate == false)
                .OrderByDescending(f => f.Id)
                .FirstOrDefault(f => f.GameVersionFlavor == clientTypeStr && f.ReleaseType == CurseReleaseType.Release);
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
                return await url
                    .PostJsonAsync(addonIds.ToArray())
                    .ReceiveJson<List<CurseSearchResult>>();
            }
            catch (Exception ex)
            {
                Log.Error(ex, "GetAllIds");
                Console.WriteLine(ex);
                return new List<CurseSearchResult>();
            }
        }

        private async Task<IList<CurseSearchResult>> GetSearchResults(string query)
        {
            var url = $"{ApiUrl}/addon/search";

            try
            {
                return await url
                    .SetQueryParams(new { gameId = 1, searchFilter = query })
                    .GetJsonAsync<IList<CurseSearchResult>>();
            }
            catch (Exception ex)
            {
                Log.Error(ex, "GetSearchResults");
                Console.WriteLine(ex);
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

                var response = await url
                    .PostJsonAsync(body)
                    .ReceiveJson<CurseGetFeaturedResponse>();

                return response.Popular.ToList();
            }
            catch (Exception ex)
            {
                Log.Error(ex, "GetSearchResults");
                Console.WriteLine(ex);
                return new List<CurseSearchResult>();
            }
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

        private string GetClientTypeString(WowClientType clientType)
        {
            switch (clientType)
            {
                case WowClientType.Classic:
                case WowClientType.ClassicPtr:
                    return "wow_classic";
                case WowClientType.Retail:
                case WowClientType.RetailPtr:
                default:
                    return "wow_retail";
            }
        }
    }
}
