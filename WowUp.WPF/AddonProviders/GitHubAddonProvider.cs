using Flurl.Http;
using Serilog;
using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Threading.Tasks;
using WowUp.Common.Enums;
using WowUp.Common.Exceptions;
using WowUp.Common.Models;
using WowUp.Common.Models.Addons;
using WowUp.Common.Models.GitHub;
using WowUp.WPF.AddonProviders.Contracts;
using WowUp.WPF.Entities;
using WowUp.WPF.Models.WowUp;
using WowUp.WPF.Utilities;

namespace WowUp.WPF.AddonProviders
{
    public class GitHubAddonProvider : IGitHubAddonProvider
    {
        private const string ApiUrl = "https://api.github.com/repos";
        private const string ReleasesUrlFormat = ApiUrl + "{0}/releases";
        private const string RepositoryUrlFormat = ApiUrl + "{0}";

        private static readonly string[] ReleaseContentTypes = new[] { "application/x-zip-compressed", "application/zip" };

        public string Name => "GitHub";

        public Task Scan(
            WowClientType clientType,
            AddonChannelType addonChannelType, 
            IEnumerable<AddonFolder> addonFolders)
        {
            Log.Debug($"{Name} Scanning {addonFolders.Count()} addons");
            return Task.CompletedTask;
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
            var results = await GetReleases(addonId);

            if (!results.Any())
            {
                return null;
            }

            var latestRelease = GetLatestRelease(results);
            if (latestRelease == null)
            {
                return null;
            }

            var asset = GetValidAsset(latestRelease, clientType);
            if (asset == null)
            {
                return null;
            }

            var repository = await GetRepository(addonId);
            var author = repository.Owner.Login;
            var authorImageUrl = repository.Owner.AvatarUrl;

            var name = GetAddonName(addonId);

            var searchResultFile = new AddonSearchResultFile
            {
                ChannelType = AddonChannelType.Stable,
                DownloadUrl = asset.BrowserDownloadUrl,
                Folders = new List<string> { name },
                GameVersion = string.Empty,
                Version = asset.Name,
                ReleaseDate = asset.CreatedAt,
                Dependencies = Enumerable.Empty<AddonSearchResultDependency>()
            };

            var searchResult = new AddonSearchResult
            {
                Author = author,
                ExternalId = addonId,
                ExternalUrl = asset.Url,
                Files = new List<AddonSearchResultFile> { searchResultFile },
                Name = name,
                ProviderName = Name,
                ThumbnailUrl = authorImageUrl
            };

            return searchResult;
        }

        public void OnPostInstall(Addon addon)
        {
            throw new NotImplementedException();
        }

        public Task<IList<PotentialAddon>> GetFeaturedAddons(WowClientType clientType)
        {
            return Task.FromResult(new List<PotentialAddon>() as IList<PotentialAddon>);
        }

        public bool IsValidAddonUri(Uri addonUri)
        {
            return string.IsNullOrEmpty(addonUri.Host) == false &&
                addonUri.Host.EndsWith("github.com");
        }

        public Task<IEnumerable<PotentialAddon>> Search(string query, WowClientType clientType)
        {
            return Task.FromResult(new List<PotentialAddon>() as IEnumerable<PotentialAddon>);
        }

        public Task<IEnumerable<AddonSearchResult>> Search(string addonName, string folderName, WowClientType clientType, string nameOverride = null)
        {
            return Task.FromResult(new List<AddonSearchResult>() as IEnumerable<AddonSearchResult>);
        }

        public async Task<PotentialAddon> Search(Uri addonUri, WowClientType clientType)
        {
            var repoPath = addonUri.LocalPath;
            var repoExtension = Path.GetExtension(repoPath);
            if (string.IsNullOrEmpty(repoPath) || !string.IsNullOrEmpty(repoExtension))
            {
                throw new InvalidUrlException($"Invlaid URL: {addonUri}");
            }

            var results = await GetReleases(repoPath);
            var latestRelease = GetLatestRelease(results);
            var asset = GetValidAsset(latestRelease, clientType);

            if (asset == null)
            {
                throw new NoReleaseFoundException();
            }

            var repository = await GetRepository(repoPath);
            var author = repository.Owner.Login;
            var authorImageUrl = repository.Owner.AvatarUrl;

            var potentialAddon = new PotentialAddon
            {
                Author = author,
                DownloadCount = asset.DownloadCount,
                ExternalId = repoPath,
                ExternalUrl = latestRelease.Url,
                Name = asset.Name,
                ProviderName = Name,
                ThumbnailUrl = authorImageUrl
            };

            return potentialAddon;
        }

        private async Task<IEnumerable<GitHubRelease>> GetReleases(string repositoryPath)
        {
            var url = string.Format(ReleasesUrlFormat, repositoryPath);

            try
            {
                return await url
                .WithHeaders(HttpUtilities.DefaultHeaders)
                .GetJsonAsync<IEnumerable<GitHubRelease>>();
            }
            catch (FlurlHttpException ex)
            {
                if (ex.Message.Contains("rate limit exceeded", StringComparison.OrdinalIgnoreCase))
                {
                    throw new RateLimitExceededException();
                }

                throw;
            }
        }

        private async Task<GitHubRepository> GetRepository(string repositoryPath)
        {
            var url = string.Format(RepositoryUrlFormat, repositoryPath);

            return await url
                .WithHeaders(HttpUtilities.DefaultHeaders)
                .GetJsonAsync<GitHubRepository>();
        }

        private GitHubAsset GetValidAsset(GitHubRelease release, WowClientType clientType)
        {
            return release.Assets
                .Where(asset => IsNotNoLib(asset) &&
                    IsValidContentType(asset) &&
                    IsValidClientType(clientType, asset))
                .FirstOrDefault();
        }

        private GitHubRelease GetLatestRelease(IEnumerable<GitHubRelease> releases)
        {
            return releases
                .Where(r => !r.Draft)
                .OrderByDescending(r => r.PublishedAt)
                .FirstOrDefault();
        }

        private string GetAddonName(string addonId)
        {
            return addonId.Split("/")
                .Where(str => !string.IsNullOrEmpty(str))
                .Skip(1)
                .FirstOrDefault();
        }

        private bool IsNotNoLib(GitHubAsset asset)
        {
            return !asset.Name.Contains("-nolib", StringComparison.OrdinalIgnoreCase);
        }

        private bool IsValidContentType(GitHubAsset asset)
        {
            return ReleaseContentTypes.Any(ct => ct == asset.ContentType);
        }

        private bool IsValidClientType(WowClientType clientType, GitHubAsset asset)
        {
            var isClassic = IsClassicAsset(asset);

            switch (clientType)
            {
                case WowClientType.Retail:
                case WowClientType.RetailPtr:
                case WowClientType.Beta:
                    return !isClassic;
                case WowClientType.Classic:
                case WowClientType.ClassicPtr:
                    return isClassic;
                default:
                    return false;
            }
        }

        private bool IsClassicAsset(GitHubAsset asset)
        {
            return asset.Name.EndsWith("-classic.zip");
        }


    }
}
