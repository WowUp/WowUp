using Flurl;
using Flurl.Http;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using WowUp.WPF.AddonProviders.Contracts;
using WowUp.WPF.Models;
using WowUp.WPF.Models.Curse;

namespace WowUp.WPF.AddonProviders
{
    public class CurseAddonProvider : IAddonProvider
    {
        private const string ApiUrl = "https://addons-ecs.forgesvc.net/api/v2";

        public string Name => "Curse";

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
                    ExternalId = id,
                    Folders = folders,
                    GameVersion = gameVersion,
                    Name = name,
                    ThumbnailUrl = thumbnailUrl,
                    Version = fileName,
                    DownloadUrl = downloadUrl
                };
            }
            catch (Exception ex)
            {
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
            if (result.Name.Contains("Details"))
            {

            }
            var clientTypeStr = GetClientTypeString(clientType);

            return result.LatestFiles
                    .OrderByDescending(f => f.Id)
                    .FirstOrDefault(f => f.GameVersionFlavor == clientTypeStr && f.ReleaseType == CurseReleaseType.Release);
        }

        private string GetThumbnailUrl(CurseSearchResult result)
        {
            return result.Attachments
                .FirstOrDefault(f => f.IsDefault && !string.IsNullOrEmpty(f.ThumbnailUrl))?.ThumbnailUrl;
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
                Console.WriteLine(ex);
                return new List<CurseSearchResult>();
            }
        }

        private string GetClientTypeString(WowClientType clientType)
        {
            return clientType == WowClientType.Retail
                ? "wow_retail"
                : "wow_classic";
        }
    }
}
