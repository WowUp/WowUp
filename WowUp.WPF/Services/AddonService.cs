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
using Serilog;

namespace WowUp.WPF.Services
{
    public class AddonService : IAddonService
    {
        protected const string BackupFolder = "AddonBackups";

        // TODO this is probably no longer needed.
        protected readonly Dictionary<string, string> _addonNameOverrides = new Dictionary<string, string>
        {
            ["Ask Mr. Robot"] = "askmrrobot"
        };

        protected readonly IEnumerable<IAddonProvider> _providers = new List<IAddonProvider>();

        protected readonly IAddonRepository _addonRepository;
        protected readonly IDependencyRepository _dependencyRepository;

        protected readonly IAnalyticsService _analyticsService;
        protected readonly IDownloadService _downloadService;
        protected readonly IWarcraftService _warcraftService;
        protected readonly IWowUpService _wowUpService;

        public event AddonEventHandler AddonUninstalled;
        public event AddonEventHandler AddonInstalled;
        public event AddonEventHandler AddonUpdated;
        public event AddonStateEventHandler AddonStateChanged;
        public event AddonListUpdatedEventHandler AddonListUpdated;

        public string BackupPath => Path.Combine(FileUtilities.AppDataPath, BackupFolder);

        public string GetFullInstallPath(Addon addon) => Path.GetFullPath(Path.Combine(_warcraftService.GetAddonFolderPath(addon.ClientType), addon.FolderName));

        public AddonService(
            IServiceProvider serviceProvider,
            IAddonRepository addonRepository,
            IAnalyticsService analyticsService,
            IDownloadService downloadSevice,
            IWarcraftService warcraftService,
            IWowUpService wowUpService,
            IDependencyRepository dependencyRepository)
        {
            _addonRepository = addonRepository;

            _analyticsService = analyticsService;
            _downloadService = downloadSevice;
            _warcraftService = warcraftService;
            _wowUpService = wowUpService;
            _dependencyRepository = dependencyRepository;

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

        public async Task<int> ProcessAutoUpdates()
        {
            var autoUpdateAddons = GetAutoUpdateEnabledAddons();
            var clientTypeGroups = autoUpdateAddons.GroupBy(addon => addon.ClientType);
            var updateCt = 0;

            foreach (var clientTypeGroup in clientTypeGroups)
            {
                if(!await SyncAddons(clientTypeGroup.Key, clientTypeGroup))
                {
                    continue;
                }

                foreach (var addon in clientTypeGroup)
                {
                    if (!addon.CanUpdate())
                    {
                        continue;
                    }

                    try
                    {
                        await InstallAddon(addon.Id);
                        updateCt += 1;
                    }
                    catch(Exception ex)
                    {
                        _analyticsService.Track(ex, "Failed to install addon");
                    }
                }
            }

            return updateCt;
        }

        public List<Addon> GetAutoUpdateEnabledAddons()
        {
            return _addonRepository
                .Query(addons => addons.Where(addon => !addon.IsIgnored && addon.AutoUpdateEnabled))
                .ToList();
        }

        public bool IsInstalled(string externalId, WowClientType clientType)
        {
            return _addonRepository.GetByExternalId(externalId, clientType) != null;
        }

        public Addon GetAddon(int addonId)
        {
            return _addonRepository.Query(table => table.FirstOrDefault(a => a.Id == addonId));
        }

        private List<string> GetExternalIdsForProvider(IAddonProvider provider, IEnumerable<Addon> addons)
        {
            return addons.Where(addon => addon.ProviderName == provider.Name)
                .Select(addon => addon.ExternalId)
                .ToList();
        }

        public async Task<List<PotentialAddon>> Search(
            string query, 
            WowClientType clientType,
            Action<Exception> onProviderError)
        {
            var potentialAddons = new List<PotentialAddon>();

            List<PotentialAddon> searchResults = new List<PotentialAddon>();
            foreach(var provider in _providers)
            {
                try
                {
                    var results = await provider.Search(query, clientType);
                    searchResults.AddRange(results);
                }
                catch(Exception ex)
                {
                    var message = $"Failed to search provider {provider.Name}";
                    Log.Error(ex, message);
                    onProviderError?.Invoke(new Exception(message));
                }
            }

            await _analyticsService.TrackUserAction("Addons", "Search", $"{clientType}|{query}");

            return searchResults.OrderByDescending(res => res.DownloadCount).ToList();
        }

        public async Task<List<PotentialAddon>> GetFeaturedAddons(WowClientType clientType)
        {
            List<PotentialAddon> addonResults = new List<PotentialAddon>();
            foreach (var provider in _providers)
            {
                try
                {
                    var result = await provider.GetFeaturedAddons(clientType);
                    addonResults.AddRange(result);
                }
                catch(Exception ex)
                {
                    Log.Error(ex, $"Failed to get feature addons from {provider.Name}");
                }
            }

            return addonResults
                .OrderByDescending(result => result.DownloadCount)
                .ToList();
        }

        public int GetAddonCount(WowClientType clientType)
        {
            return GetAllStoredAddons(clientType).Count;
        }

        public async Task<List<Addon>> GetAddons(WowClientType clientType, bool rescan = false)
        {
            try
            {
                var addons = GetAllStoredAddons(clientType);
                if (rescan || !addons.Any())
                {
                    var newAddons = await ScanAddons(
                        clientType,
                        ex =>
                        {
                            System.Windows.MessageBox.Show(ex.Message, "Error", System.Windows.MessageBoxButton.OK);
                        });
                    addons = UpdateAddons(addons, newAddons);
                    AddonListUpdated?.Invoke(this, EventArgs.Empty);
                }

                await SyncAddons(clientType, addons);
                return addons;
            }
            catch(Exception ex)
            {
                _analyticsService.Track(ex, $"Failed to get addons for client {clientType}");

                return new List<Addon>();
            }
        }

        private List<Addon> UpdateAddons(List<Addon> existingAddons, List<Addon> newAddons)
        {
            // Clear the dependency table, since rebuilding it is extra complicated.
            _dependencyRepository.RemoveAll();

            foreach(var newAddon in newAddons)
            {
                var existingAddon = existingAddons
                    .FirstOrDefault(ea => ea.ExternalId == newAddon.ExternalId && ea.ProviderName == newAddon.ProviderName);

                if(existingAddon == null)
                {
                    continue;
                }

                newAddon.AutoUpdateEnabled = existingAddon.AutoUpdateEnabled;
                newAddon.IsIgnored= existingAddon.IsIgnored;
            }

            _addonRepository.DeleteItems(existingAddons);
            _addonRepository.SaveItems(newAddons);

            return newAddons;
        }

        private async Task<bool> SyncAddons(WowClientType clientType, IEnumerable<Addon> addons)
        {
            try
            {
                foreach (var provider in _providers)
                {
                    await SyncAddons(clientType, addons, provider);
                }

                return true;
            }
            catch (Exception ex)
            {
                _analyticsService.Track(ex, "Failed to sync addons");
                return false;
            }
        }

        private async Task SyncAddons(
            WowClientType clientType, 
            IEnumerable<Addon> addons,
            IAddonProvider provider)
        {
            var providerAddonIds = GetExternalIdsForProvider(provider, addons);
            if (!providerAddonIds.Any())
            {
                return;
            }

            var searchResults = await provider.GetAll(clientType, providerAddonIds);

            foreach (var result in searchResults)
            {
                var addon = addons.FirstOrDefault(addon => addon.ExternalId == result.ExternalId);
                var latestFile = GetLatestFile(result, addon.ChannelType);

                if (result == null || latestFile == null || latestFile.Version == addon.LatestVersion)
                {
                    if(addon.ThumbnailUrl != result.ThumbnailUrl)
                    {
                        addon.ThumbnailUrl = result.ThumbnailUrl;
                        _addonRepository.UpdateItem(addon);
                        await SyncThumbnail(addon, true);
                    }
                    else
                    {
                        await SyncThumbnail(addon);
                    }

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

        private async Task SyncThumbnail(Addon addon, bool force = false)
        {
            if (force || !File.Exists(addon.GetThumbnailPath()))
            {
                await CacheThumbnail(addon);
            }
        }

        private AddonSearchResultFile GetLatestFile(AddonSearchResult searchResult, AddonChannelType channelType)
        {
            return searchResult.Files
                .OrderByDescending(f => f.ReleaseDate)
                .FirstOrDefault(lf => lf.ChannelType <= channelType);
        }

        public async Task<PotentialAddon> GetAddonByUri(
            Uri addonUri,
            WowClientType clientType,
            Action<AddonInstallState, decimal> onUpdate = null)
        {
            var provider = GetAddonProvider(addonUri);

            return await provider.Search(addonUri, clientType);
        }

        public async Task UninstallAddon(Addon addon, bool uninstallDependencies)
        {
            var installedDirectories = addon.GetInstalledDirectories();
            var addonFolder = _warcraftService.GetAddonFolderPath(addon.ClientType);

            RemoveThumbnail(addon);

            foreach (var dir in installedDirectories)
            {
                var addonDirectory = Path.Combine(addonFolder, dir);
                await FileUtilities.DeleteDirectory(addonDirectory);
            }

            if (uninstallDependencies)
            {
                await UninstallDependencies(addon);
            }

            _addonRepository.DeleteItem(addon);

            AddonUninstalled?.Invoke(this, new AddonEventArgs(addon, AddonChangeType.Uninstalled));
        }

        public IEnumerable<AddonDependency> GetDependencies(Addon addon)
        {
            return _dependencyRepository.GetAddonDependencies(addon);
        }

        public bool HasDependencies(Addon addon)
        {
            return GetDependencies(addon).Any();
        }

        public int GetDependencyCount(Addon addon)
        {
            return GetDependencies(addon).Count();
        }

        public async Task UninstallDependencies(Addon addon)
        {
            var addonDependencies = GetDependencies(addon);
            foreach (var dependency in addonDependencies)
            {
                var dependencyAddon = GetAddon(dependency.DependencyId);
                if (dependencyAddon != null && 
                    _dependencyRepository
                        .GetDependentAddons(dependencyAddon)
                        .All(dep => dep.AddonId == addon.Id))
                {
                    await UninstallAddon(dependencyAddon, true);
                }
                _dependencyRepository.DeleteItem(dependency);
            }
            _dependencyRepository.DeleteItems(_dependencyRepository.GetDependentAddons(addon));
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
            WowClientType clientType,
            List<Addon> addonDependencies = null)
        {
            var targetAddonChannel = _wowUpService.GetClientAddonChannelType(clientType);
            var provider = GetProvider(providerName);
            var searchResult = await provider.GetById(externalId, clientType);
            var latestFile = GetLatestFile(searchResult, targetAddonChannel);
            if (latestFile == null)
            {
                latestFile = searchResult.Files.First();
                targetAddonChannel = latestFile.ChannelType;
            }

            foreach (var dependency in latestFile.Dependencies.Where(dep => dep.Type == AddonDependencyType.Required))
            {
                addonDependencies ??= new List<Addon>();
                var resolvedDependency = await GetAddon(dependency.AddonId.ToString(), providerName, clientType, addonDependencies);
                addonDependencies.Add(resolvedDependency);
            }

            return CreateAddon(latestFile.Folders.FirstOrDefault(), searchResult, latestFile, clientType, targetAddonChannel, addonDependencies);
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

            await InstallDependencies(addon);
            await InstallAddon(addon.Id, onUpdate);
        }

        public async Task InstallDependencies(Addon addon)
        {
            if (addon.Dependencies == null)
                return;

            var dependencyList = new List<AddonDependency>();
            foreach (var dependency in addon.Dependencies)
            {
                var installed = _addonRepository.GetByExternalId(dependency.ExternalId, addon.ClientType);
                if (installed == null || installed.ProviderName != dependency.ProviderName)
                {
                    _addonRepository.SaveItem(dependency);
                    await InstallAddon(dependency.Id);
                }

                dependencyList.Add(new AddonDependency
                {
                    DependencyId = installed?.Id ?? dependency.Id,
                    AddonId = addon.Id,
                    Type = AddonDependencyType.Required
                });
            }

            _dependencyRepository.SaveItems(dependencyList);
        }

        private void SendAddonStateChange(
            Addon addon, 
            AddonInstallState addonInstallState, 
            decimal progress)
        {
            AddonStateChanged?.Invoke(this, new AddonStateEventArgs
            {
                Addon = addon,
                AddonInstallState = addonInstallState,
                Progress = progress
            });
        }

        public async Task InstallAddon(int addonId, Action<AddonInstallState, decimal> updateAction = null)
        {
            var addon = GetAddon(addonId);
            if (addon == null || string.IsNullOrEmpty(addon.DownloadUrl))
            {
                throw new Exception("Addon not found or invalid");
            }

            updateAction?.Invoke(AddonInstallState.Downloading, 25m);
            SendAddonStateChange(addon, AddonInstallState.Downloading, 25m);

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
                    SendAddonStateChange(addon, AddonInstallState.BackingUp, 75m);
                    var backupZipFilePath = Path.Combine(BackupPath, $"{addon.Name}-{addon.InstalledVersion}.zip");
                    //await _downloadService.ZipFile(downloadedFilePath, backupZipFilePath);
                }

                updateAction?.Invoke(AddonInstallState.Installing, 75m);
                SendAddonStateChange(addon, AddonInstallState.Installing, 75m);

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
            SendAddonStateChange(addon, AddonInstallState.Complete, 100m);
        }

        private async Task CacheThumbnail(Addon addon)
        {
            if (string.IsNullOrEmpty(addon.ThumbnailUrl))
            {
                return;
            }

            try
            {
                Log.Information($"Caching thumbnail {addon.Name}: {addon.ThumbnailUrl}");
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
                _analyticsService.Track(ex, $"Failed to download thumbnail {addon.Name}");
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
            await Task.Run(async () =>
            {
                var addonFolderPath = _warcraftService.GetAddonFolderPath(clientType);
                var unzippedFolders = Directory.GetDirectories(unzippedDirectory);
                foreach (var unzippedFolder in unzippedFolders)
                {
                    var unzippedDirectoryName = Path.GetFileName(unzippedFolder);
                    var unzipLocation = Path.Combine(addonFolderPath, unzippedDirectoryName);
                    var unzipBackupLocation = Path.Combine(addonFolderPath, $"{unzippedDirectoryName}-bak");

                    // If the user already has the addon installed, create a temporary backup
                    if (Directory.Exists(unzipLocation))
                    {
                        Directory.Move(unzipLocation, unzipBackupLocation);
                    }

                    try
                    {
                        // Copy contents from unzipped new directory to existing addon folder location
                        FileUtilities.DirectoryCopy(unzippedFolder, unzipLocation);

                        // If the copy succeeds, delete the backup
                        if (Directory.Exists(unzipBackupLocation))
                        {
                            await FileUtilities.DeleteDirectory(unzipBackupLocation);
                        }
                    }
                    catch (Exception ex)
                    {
                        _analyticsService.Track(ex, $"Failed to copy addon directory {unzipLocation}");
                        // If a backup directory exists, attempt to roll back
                        if (Directory.Exists(unzipBackupLocation))
                        {
                            // If the new addon folder was already created delete it
                            if (Directory.Exists(unzipLocation))
                            {
                                await FileUtilities.DeleteDirectory(unzipLocation);
                            }

                            // Move the backup folder into the original location
                            Log.Information($"Attempting to roll back {unzipBackupLocation}");
                            Directory.Move(unzipBackupLocation, unzipLocation);
                        }

                        throw;
                    }
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

        private async Task<List<Addon>> ScanAddons(
            WowClientType clientType, 
            Action<Exception> onScanError)
        {
            var addonFolders = await _warcraftService.ListAddons(clientType);

            foreach (var provider in _providers)
            {
                try
                {
                    await provider.Scan(
                        clientType,
                        _wowUpService.GetClientAddonChannelType(clientType),
                        addonFolders.Where(af => af.MatchingAddon == null && af.Toc != null));
                }
                catch(Exception ex)
                {
                    _analyticsService.Track(ex, $"Addon scan failed {provider.Name}");
                    onScanError?.Invoke(new Exception($"Failed to scan from {provider.Name}"));
                }
            }

            Log.Debug($"Scanned {addonFolders.Count()} folders");

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
            AddonChannelType? channelType = null,
            IEnumerable<Addon> dependencies = null)
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
                ChannelType = channelType ?? _wowUpService.GetClientAddonChannelType(clientType),
                AutoUpdateEnabled = _wowUpService.GetClientDefaultAutoUpdate(clientType),
                Dependencies =  dependencies
            };
        }
    }
}
