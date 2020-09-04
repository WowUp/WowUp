using Flurl.Http;
using Microsoft.Extensions.DependencyInjection;
using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Threading.Tasks;
using WowUp.Common.Enums;
using WowUp.Common.Exceptions;
using WowUp.Common.Models;
using WowUp.Common.Models.Addons;
using WowUp.Common.Services.Contracts;
using WowUp.WPF.AddonProviders.Contracts;
using WowUp.WPF.Entities;
using WowUp.WPF.Extensions;
using WowUp.WPF.Models.Events;
using WowUp.WPF.Repositories.Contracts;
using WowUp.WPF.Services.Contracts;
using WowUp.WPF.Utilities;
using SixLabors.ImageSharp;
using SixLabors.ImageSharp.Processing;

namespace WowUp.WPF.Services
{
    public class AddonService : IAddonService
    {
        protected const string BackupFolder = "AddonBackups";

        protected readonly Dictionary<string, string> _addonNameOverrides = new Dictionary<string, string>
        {
            ["Ask Mr. Robot"] = "askmrrobot"
        };

        protected readonly IEnumerable<IAddonProvider> _providers = new List<IAddonProvider>();

        protected readonly IAddonRepository _addonRepository;

        protected readonly IAnalyticsService _analyticsService;
        protected readonly IDownloadService _downloadService;
        protected readonly IWarcraftService _warcraftService;
        protected readonly IWowUpService _wowUpService;

        public event AddonEventHandler AddonUninstalled;
        public event AddonEventHandler AddonInstalled;
        public event AddonEventHandler AddonUpdated;

        public string BackupPath => Path.Combine(FileUtilities.AppDataPath, BackupFolder);

        public AddonService(
            IServiceProvider serviceProvider,
            IAddonRepository addonRepository,
            IAnalyticsService analyticsService,
            IDownloadService downloadSevice,
            IWarcraftService warcraftService,
            IWowUpService wowUpService)
        {
            _addonRepository = addonRepository;

            _analyticsService = analyticsService;
            _downloadService = downloadSevice;
            _warcraftService = warcraftService;
            _wowUpService = wowUpService;

            _providers = new List<IAddonProvider>
            {
               serviceProvider.GetService<ICurseAddonProvider>(),
               serviceProvider.GetService<ITukUiAddonProvider>(),
               serviceProvider.GetService<IWowInterfaceAddonProvider>(),
               serviceProvider.GetService<IGitHubAddonProvider>()
            };

            InitializeDirectories();
        }

        public Addon UpdateAddon(Addon addon)
        {
            _addonRepository.SaveItem(addon);

            AddonUpdated?.Invoke(this, new AddonEventArgs(addon, AddonChangeType.Updated));

            return addon;
        }

        public bool IsInstalled(string externalId, WowClientType clientType)
        {
            return _addonRepository.GetByExternalId(externalId, clientType) != null;
        }

        public Addon GetAddon(int addonId)
        {
            return _addonRepository.Query(table => table.FirstOrDefault(a => a.Id == addonId));
        }

        public async Task<List<PotentialAddon>> Search(string query, WowClientType clientType)
        {
            var potentialAddons = new List<PotentialAddon>();

            var searchTasks = _providers.Select(p => p.Search(query, clientType));
            var searchResults = await Task.WhenAll(searchTasks);

            await _analyticsService.TrackUserAction("Addons", "Search", $"{clientType}|{query}");

            return searchResults.SelectMany(res => res).OrderByDescending(res => res.DownloadCount).ToList();
        }

        public async Task<List<PotentialAddon>> GetFeaturedAddons(WowClientType clientType)
        {
            var addonTasks = _providers.Select(p => p.GetFeaturedAddons(clientType));
            var addonResults = await Task.WhenAll(addonTasks);
            var addonResultsConcat = addonResults.SelectMany(res => res);

            return addonResultsConcat.ToList();
        }

        public async Task<List<Addon>> GetAddons(WowClientType clientType, bool rescan = false)
        {
            var addons = GetAllStoredAddons(clientType);
            if (rescan || !addons.Any())
            {
                RemoveAddons(clientType);
                addons = await ScanAddons(clientType);
                SaveAddons(addons);
            }

            await SyncAddons(clientType, addons);

            return addons;
        }

        private void RemoveAddons(WowClientType clientType)
        {
            var addons = GetAllStoredAddons(clientType);
            _addonRepository.DeleteItems(addons);
        }

        private async Task SyncAddons(WowClientType clientType, IEnumerable<Addon> addons)
        {
            try
            {
                foreach (var provider in _providers)
                {
                    var providerAddonIds = addons
                        .Where(addon => addon.ProviderName == provider.Name)
                        .Select(addon => addon.ExternalId);

                    var addonResults = await provider.GetAll(clientType, providerAddonIds);

                    foreach (var result in addonResults)
                    {
                        var addon = addons.FirstOrDefault(addon => addon.ExternalId == result.ExternalId);
                        var latestFile = GetLatestFile(result, addon.ChannelType);

                        if (result == null || latestFile == null || latestFile.Version == addon.LatestVersion)
                        {
                            await SyncThumbnail(addon);

                            continue;
                        }

                        addon.LatestVersion = latestFile.Version;
                        addon.Name = result.Name;
                        addon.Author = result.Author;
                        addon.DownloadUrl = latestFile.DownloadUrl;

                        if (!string.IsNullOrEmpty(latestFile.GameVersion))
                        {
                            addon.GameVersion = latestFile.GameVersion;
                        }

                        addon.ThumbnailUrl = result.ThumbnailUrl;
                        addon.ExternalUrl = result.ExternalUrl;

                        await SyncThumbnail(addon);

                        _addonRepository.UpdateItem(addon);
                    }
                }
            }
            catch (Exception ex)
            {
                _analyticsService.Track(ex, "Failed to sync addons");
            }
        }

        private async Task SyncThumbnail(Addon addon)
        {
            if (!File.Exists(addon.GetThumbnailPath()))
            {
                await CacheThumbnail(addon);
            }
        }

        private AddonSearchResultFile GetLatestFile(AddonSearchResult searchResult, AddonChannelType channelType)
        {
            return searchResult.Files
                .Where(lf => lf.ChannelType <= channelType)
                .FirstOrDefault();
        }

        public async Task<PotentialAddon> GetAddonByUri(
            Uri addonUri,
            WowClientType clientType,
            Action<AddonInstallState, decimal> onUpdate = null)
        {
            var provider = GetAddonProvider(addonUri);

            return await provider.Search(addonUri, clientType);
        }

        public async Task UninstallAddon(Addon addon)
        {
            var installedDirectories = addon.GetInstalledDirectories();
            var addonFolder = _warcraftService.GetAddonFolderPath(addon.ClientType);

            RemoveThumbnail(addon);

            foreach (var dir in installedDirectories)
            {
                var addonDirectory = Path.Combine(addonFolder, dir);
                await FileUtilities.DeleteDirectory(addonDirectory);
            }

            _addonRepository.DeleteItem(addon);

            AddonUninstalled?.Invoke(this, new AddonEventArgs(addon, AddonChangeType.Uninstalled));
        }

        private void RemoveThumbnail(Addon addon)
        {
            var thumbnailPath = addon.GetThumbnailPath();
            if (File.Exists(thumbnailPath))
            {
                File.Delete(thumbnailPath);
            }
        }

        public async Task<Addon> GetAddon(
            string externalId,
            string providerName,
            WowClientType clientType)
        {
            var targetAddonChannel = _wowUpService.GetDefaultAddonChannel();
            var provider = GetProvider(providerName);
            var searchResult = await provider.GetById(externalId, clientType);
            var latestFile = GetLatestFile(searchResult, targetAddonChannel);
            if (latestFile == null)
            {
                latestFile = searchResult.Files.First();
                targetAddonChannel = latestFile.ChannelType;
            }

            return CreateAddon(latestFile.Folders.FirstOrDefault(), searchResult, latestFile, clientType, targetAddonChannel);
        }

        private IAddonProvider GetProvider(string providerName)
        {
            return _providers.First(p => p.Name == providerName);
        }

        public async Task InstallAddon(
            PotentialAddon potentialAddon,
            WowClientType clientType,
            Action<AddonInstallState, decimal> onUpdate = null)
        {
            var existingAddon = _addonRepository.GetByExternalId(potentialAddon.ExternalId, clientType);
            if (existingAddon != null)
            {
                throw new AddonAlreadyInstalledException();
            }

            var addon = await GetAddon(potentialAddon.ExternalId, potentialAddon.ProviderName, clientType);

            _addonRepository.SaveItem(addon);

            await InstallAddon(addon.Id, onUpdate);
        }

        public async Task InstallAddon(int addonId, Action<AddonInstallState, decimal> updateAction)
        {
            var addon = GetAddon(addonId);
            if (addon == null || string.IsNullOrEmpty(addon.DownloadUrl))
            {
                throw new Exception("Addon not found or invalid");
            }

            updateAction?.Invoke(AddonInstallState.Downloading, 25m);

            string downloadedFilePath = string.Empty;
            string unzippedDirectory = string.Empty;
            string downloadedThumbnail = string.Empty;
            try
            {
                await CacheThumbnail(addon);

                downloadedFilePath = await _downloadService.DownloadZipFile(addon.DownloadUrl, FileUtilities.DownloadPath);

                if (!string.IsNullOrEmpty(addon.InstalledVersion))
                {
                    updateAction?.Invoke(AddonInstallState.BackingUp, 0.50m);
                    var backupZipFilePath = Path.Combine(BackupPath, $"{addon.Name}-{addon.InstalledVersion}.zip");
                    //await _downloadService.ZipFile(downloadedFilePath, backupZipFilePath);
                }

                updateAction?.Invoke(AddonInstallState.Installing, 75m);

                unzippedDirectory = await _downloadService.UnzipFile(downloadedFilePath);

                await InstallUnzippedDirectory(unzippedDirectory, addon.ClientType);
                var unzippedDirectoryNames = FileUtilities.GetDirectoryNames(unzippedDirectory);

                addon.InstalledVersion = addon.LatestVersion;
                addon.InstalledAt = DateTime.UtcNow;
                addon.InstalledFolders = string.Join(',', unzippedDirectoryNames);

                if (string.IsNullOrEmpty(addon.GameVersion))
                {
                    addon.GameVersion = GetLatestGameVersion(unzippedDirectory, unzippedDirectoryNames);
                }

                _addonRepository.UpdateItem(addon);

                await _analyticsService.TrackUserAction("Addons", "InstallById", $"{addon.ClientType}|{addon.Name}");

                AddonInstalled?.Invoke(this, new AddonEventArgs(addon, AddonChangeType.Installed));
            }
            catch (Exception ex)
            {
                _analyticsService.Track(ex, "InstallAddon");
            }
            finally
            {
                if (!string.IsNullOrEmpty(unzippedDirectory))
                {
                    await FileUtilities.DeleteDirectory(unzippedDirectory);
                }

                if (!string.IsNullOrEmpty(downloadedFilePath))
                {
                    File.Delete(downloadedFilePath);
                }
            }

            updateAction?.Invoke(AddonInstallState.Complete, 100m);
        }

        private async Task CacheThumbnail(Addon addon)
        {
            if (string.IsNullOrEmpty(addon.ThumbnailUrl))
            {
                return;
            }

            try
            {
                using var imageStream = await addon.ThumbnailUrl.GetStreamAsync();

                using Image image = Image.Load(imageStream);
                image.Mutate(x => x.Resize(new ResizeOptions
                {
                    Size = new Size
                    {
                        Width = 80,
                        Height = 80
                    }
                }));

                image.Save(addon.GetThumbnailCachePath());
            }
            catch(Exception ex)
            {
                _analyticsService.Track(ex, "Failed to download thumbnail");
            }
        }

        private string GetLatestGameVersion(string baseDir, IEnumerable<string> installedFolders)
        {
            var versions = new List<string>();

            foreach (var dir in installedFolders)
            {
                var path = Path.Combine(baseDir, dir);

                var tocFile = FileUtilities.GetFiles(path, "*.toc").FirstOrDefault();
                if (tocFile == null)
                {
                    continue;
                }

                var gameVersion = new TocParser(tocFile).Interface;
                if (string.IsNullOrEmpty(gameVersion))
                {
                    continue;
                }

                versions.Add(gameVersion);
            }

            return versions.OrderByDescending(ver => ver).FirstOrDefault() ?? string.Empty;
        }

        private IAddonProvider GetAddonProvider(Uri addonUri)
        {
            return _providers.FirstOrDefault(provider => provider.IsValidAddonUri(addonUri));
        }

        private async Task InstallUnzippedDirectory(string unzippedDirectory, WowClientType clientType)
        {
            await Task.Run(() =>
            {
                var addonFolderPath = _warcraftService.GetAddonFolderPath(clientType);
                var unzippedFolders = Directory.GetDirectories(unzippedDirectory);
                foreach (var unzippedFolder in unzippedFolders)
                {
                    var unzippedDirectoryName = Path.GetFileName(unzippedFolder);
                    var unzipLocation = Path.Combine(addonFolderPath, unzippedDirectoryName);
                    FileUtilities.DirectoryCopy(unzippedFolder, unzipLocation);
                }

            });
        }

        protected virtual void InitializeDirectories()
        {
            if (!Directory.Exists(BackupPath))
            {
                Directory.CreateDirectory(BackupPath);
            }
        }

        private List<Addon> GetAllStoredAddons(WowClientType clientType)
        {
            return _addonRepository.Query(table => table.Where(a => a.ClientType == clientType)).ToList();
        }

        private void SaveAddons(IEnumerable<Addon> addons)
        {
            _addonRepository.AddItems(addons);
        }

        private async Task<List<Addon>> ScanAddons(WowClientType clientType)
        {
            var addonFolders = await _warcraftService.ListAddons(clientType);

            foreach (var provider in _providers)
            {
                try
                {
                    await provider.Scan(
                        clientType,
                        _wowUpService.GetDefaultAddonChannel(),
                        addonFolders.Where(af => af.MatchingAddon == null && af.Toc != null));
                }
                catch(Exception ex)
                {
                    _analyticsService.Track(ex, $"Addon scan failed {provider.Name}");
                }
            }

            var matchedAddonFolders = addonFolders.Where(af => af.MatchingAddon != null);
            var matchedGroups = matchedAddonFolders.GroupBy(af => $"{af.MatchingAddon.ProviderName}{af.MatchingAddon.ExternalId}");

            return matchedGroups
                .Select(g => g.First().MatchingAddon)
                .ToList();
        }

        private T GetProvider<T>()
           where T : IAddonProvider
        {
            return (T)_providers.First(p => typeof(T).IsInstanceOfType(p));
        }

        public async Task<Addon> Map(string addonName, string folderName, WowClientType clientType)
        {
            var searchResults = await Search(addonName, folderName, clientType);

            AddonSearchResult nearestResult = null;
            AddonSearchResultFile latestFile = null;
            foreach (var result in searchResults)
            {
                latestFile = GetLatestFile(result, AddonChannelType.Stable);
                if (latestFile == null)
                {
                    continue;
                }

                nearestResult = result;
                break;
            }

            if (nearestResult == null || latestFile == null)
            {
                return null;
            }

            return CreateAddon(folderName, nearestResult, latestFile, clientType);
        }

        public async Task<List<AddonSearchResult>> Search(
            string addonName,
            string folderName,
            WowClientType clientType,
            string nameOverride = null)
        {
            if (string.IsNullOrEmpty(nameOverride) && _addonNameOverrides.ContainsKey(addonName))
            {
                nameOverride = _addonNameOverrides[addonName];
            }

            var results = new List<AddonSearchResult>();
            var tasks = _providers.Select(p => p.Search(addonName, folderName, clientType, nameOverride));
            var searchResults = await Task.WhenAll(tasks);
            var searchResultsConcat = searchResults.SelectMany(res => res);

            return searchResultsConcat.ToList();
        }

        private Addon CreateAddon(
            string folderName,
            AddonSearchResult searchResult,
            AddonSearchResultFile latestFile,
            WowClientType clientType,
            AddonChannelType? channelType = null)
        {
            if (latestFile == null)
            {
                return null;
            }

            return new Addon
            {
                Name = searchResult.Name,
                ThumbnailUrl = searchResult.ThumbnailUrl,
                LatestVersion = latestFile.Version,
                ClientType = clientType,
                ExternalId = searchResult.ExternalId,
                FolderName = folderName,
                GameVersion = latestFile.GameVersion,
                Author = searchResult.Author,
                DownloadUrl = latestFile.DownloadUrl,
                ExternalUrl = searchResult.ExternalUrl,
                ProviderName = searchResult.ProviderName,
                ChannelType = channelType ?? _wowUpService.GetDefaultAddonChannel()
            };
        }
    }
}
