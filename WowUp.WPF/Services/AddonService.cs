using Serilog;
using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Threading.Tasks;
using Microsoft.Extensions.DependencyInjection;
using WowUp.WPF.AddonProviders;
using WowUp.WPF.AddonProviders.Contracts;
using WowUp.WPF.Entities;
using WowUp.WPF.Models;
using WowUp.WPF.Repositories.Contracts;
using WowUp.WPF.Services.Contracts;
using WowUp.WPF.Utilities;
using WowUp.WPF.Errors;
using WowUp.WPF.Extensions;
using WowUp.WPF.Models.Events;
using WowUp.Common.Enums;
using WowUp.Common.Services.Contracts;
using WowUp.Common.Models.Addons;

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
        protected readonly IDownloadService _downloadService;
        protected readonly IWarcraftService _warcraftService;

        public event AddonEventHandler AddonUninstalled;
        public event AddonEventHandler AddonInstalled;
        public event AddonEventHandler AddonUpdated;

        public string BackupPath => Path.Combine(FileUtilities.AppDataPath, BackupFolder);

        public AddonService(
            IServiceProvider serviceProvider,
            IAddonRepository addonRepository,
            IDownloadService downloadSevice,
            IWarcraftService warcraftService)
        {
            _addonRepository = addonRepository;
            _downloadService = downloadSevice;
            _warcraftService = warcraftService;

            _providers = new List<IAddonProvider>
            {
               serviceProvider.GetService<CurseAddonProvider>(),
               serviceProvider.GetService<TukUiAddonProvider>()
            };

            InitializeDirectories();
        }

        public Addon UpdateAddon(Addon addon)
        {
            _addonRepository.SaveItem(addon);

            AddonUpdated?.Invoke(this, new AddonEventArgs(addon));

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
                addons = await GetLocalAddons(clientType);
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
            var addonIds = addons.Select(addon => addon.ExternalId);
            try
            {
                var addonTasks = _providers.Select(p => p.GetAll(clientType, addonIds));
                var addonResults = await Task.WhenAll(addonTasks);
                var addonResultsConcat = addonResults.SelectMany(res => res);

                foreach (var addon in addons)
                {
                    var match = addonResultsConcat.FirstOrDefault(a => a.ExternalId == addon.ExternalId);
                    var latestFile = GetLatestFile(match, addon.ChannelType);
                    if (match == null || latestFile == null || latestFile.Version == addon.LatestVersion)
                    {
                        continue;
                    }

                    addon.LatestVersion = latestFile.Version;
                    addon.Name = match.Name;
                    addon.Author = match.Author;
                    addon.DownloadUrl = latestFile.DownloadUrl;
                    addon.GameVersion = latestFile.GameVersion;
                    addon.ThumbnailUrl = match.ThumbnailUrl;
                    addon.ExternalUrl = match.ExternalUrl;

                    _addonRepository.UpdateItem(addon);
                }
            }
            catch (Exception ex)
            {
                Log.Error(ex, "Failed to sync addons");
            }
        }

        private AddonSearchResultFile GetLatestFile(AddonSearchResult searchResult, AddonChannelType channelType)
        {
            return searchResult.Files
                .Where(lf => lf.ChannelType <= channelType)
                .FirstOrDefault();
        }

        public async Task InstallAddon(
            PotentialAddon potentialAddon,
            WowClientType clientType,
            Action<AddonInstallState, decimal> onUpdate = null)
        {
            var provider = _providers.First(p => p.Name == potentialAddon.ProviderName);
            var searchResult = await provider.GetById(potentialAddon.ExternalId, clientType);
            var latestFile = GetLatestFile(searchResult, AddonChannelType.Stable);

            var existingAddon = _addonRepository.GetByExternalId(searchResult.ExternalId, clientType);

            if (existingAddon != null)
            {
                throw new AddonAlreadyInstalledException();
            }

            var addon = CreateAddon(latestFile.Folders.FirstOrDefault(), searchResult, latestFile, clientType);

            _addonRepository.SaveItem(addon);

            await InstallAddon(addon.Id, onUpdate);
        }

        public async Task InstallAddon(
            Uri addonUri, 
            WowClientType clientType, 
            Action<AddonInstallState, decimal> onUpdate = null)
        {
            var provider = GetAddonProvider(addonUri);

            var searchResult = await provider.Search(addonUri, clientType);
            if(searchResult == null)
            {
                throw new AddonNotFoundException();
            }

            var latestFile = GetLatestFile(searchResult, AddonChannelType.Stable);
            if (latestFile == null)
            {
                throw new AddonNotFoundException();
            }

            var existingAddon = _addonRepository.GetByExternalId(searchResult.ExternalId, clientType);

            if(existingAddon != null)
            {
                throw new AddonAlreadyInstalledException();
            }

            var addon = CreateAddon(latestFile.Folders.FirstOrDefault(), searchResult, latestFile, clientType);

            _addonRepository.SaveItem(addon);

            await InstallAddon(addon.Id, onUpdate);
        }

        public async Task UninstallAddon(Addon addon)
        {
            var installedDirectories = addon.GetInstalledDirectories();
            var addonFolder = _warcraftService.GetAddonFolderPath(addon.ClientType);

            foreach(var dir in installedDirectories)
            {
                var addonDirectory = Path.Combine(addonFolder, dir);
                await FileUtilities.DeleteDirectory(addonDirectory);
            }

            _addonRepository.DeleteItem(addon);

            AddonUninstalled?.Invoke(this, new AddonEventArgs(addon));
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
            try
            {
                downloadedFilePath = await _downloadService.DownloadFile(addon.DownloadUrl, FileUtilities.DownloadPath);

                if (!string.IsNullOrEmpty(addon.InstalledVersion))
                {
                    updateAction?.Invoke(AddonInstallState.BackingUp, 0.50m);
                    var backupZipFilePath = Path.Combine(BackupPath, $"{addon.Name}-{addon.InstalledVersion}.zip");
                    //await _downloadService.ZipFile(downloadedFilePath, backupZipFilePath);
                }

                updateAction?.Invoke(AddonInstallState.Installing, 75m);

                unzippedDirectory = await _downloadService.UnzipFile(downloadedFilePath);

                await InstallUnzippedDirectory(unzippedDirectory, addon.ClientType);

                addon.InstalledVersion = addon.LatestVersion;
                addon.InstalledAt = DateTime.UtcNow;
                addon.InstalledFolders = string.Join(',', FileUtilities.GetDirectoryNames(unzippedDirectory));
                _addonRepository.UpdateItem(addon);

                AddonInstalled?.Invoke(this, new AddonEventArgs(addon));
            }
            catch (Exception ex)
            {
                Log.Error(ex, "InstallAddon");
                Console.WriteLine(ex);
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

        private IAddonProvider GetAddonProvider(Uri addonUri)
        {
            return _providers.FirstOrDefault(provider => provider.IsValidAddonUri(addonUri));
        }

        private async Task InstallUnzippedDirectory(string unzippedDirectory, WowClientType clientType)
        {
            var addonFolderPath = _warcraftService.GetAddonFolderPath(clientType);
            var unzippedFolders = Directory.GetDirectories(unzippedDirectory);
            foreach (var unzippedFolder in unzippedFolders)
            {
                var unzippedDirectoryName = Path.GetFileName(unzippedFolder);
                var unzipLocation = Path.Combine(addonFolderPath, unzippedDirectoryName);
                FileUtilities.DirectoryCopy(unzippedFolder, unzipLocation);
            }
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

        private async Task<List<Addon>> GetLocalAddons(WowClientType clientType)
        {
            var addonFolders = await _warcraftService.ListAddons(clientType);
            return await MapAll(addonFolders, clientType);
        }

        //public async Task<List<Addon>> MapAll(IEnumerable<Addon> addons, WowClientType clientType)
        //{
        //    if (addons == null)
        //    {
        //        Log.Warning("Addon list was null");
        //        return new List<Addon>();
        //    }

        //    foreach (var addon in addons)
        //    {
        //        Log.Debug($"Addon {addon.FolderName}");

        //        try
        //        {
        //            var searchResults = await Search(addon.Name, addon.FolderName, clientType);
        //            var firstResult = searchResults.FirstOrDefault();
        //            if (firstResult == null)
        //            {
        //                continue;
        //            }

        //            addon.LatestVersion = firstResult.Version;
        //            addon.GameVersion = firstResult.GameVersion;
        //            addon.Author = firstResult.Author;
        //        }
        //        catch (Exception ex)
        //        {
        //            Log.Error(ex, "Failed to map addon");
        //        }
        //    }

        //    return addons.ToList();
        //}

        public async Task<List<Addon>> MapAll(IEnumerable<AddonFolder> addonFolders, WowClientType clientType)
        {
            var results = new Dictionary<string, Addon>();

            foreach (var addonFolder in addonFolders)
            {
                try
                {
                    Addon addon;
                    if (!string.IsNullOrEmpty(addonFolder.Toc?.CurseProjectId))
                    {
                        var provider = _providers.First(p => p is CurseAddonProvider) as CurseAddonProvider;
                        var searchResult = await provider.GetById(addonFolder.Toc.CurseProjectId, clientType);
                        var latestFile = GetLatestFile(searchResult, AddonChannelType.Stable);
                        addon = CreateAddon(addonFolder.Name, searchResult, latestFile, clientType);
                    }
                    else
                    {
                        addon = await Map(addonFolder.Toc.Title, addonFolder.Name, clientType);
                    }

                    if (addon == null)
                    {
                        continue;
                    }

                    results[addon.Name] = addon;
                }
                catch (Exception ex)
                {
                    Log.Error(ex, $"Failed to map addon folder {addonFolder.Name}");
                }
            }

            return results.Values
                .OrderBy(v => v.Name)
                .ToList();
        }

        public async Task<Addon> Map(string addonName, string folderName, WowClientType clientType)
        {
            var searchResults = await Search(addonName, folderName, clientType);

            AddonSearchResult nearestResult = null;
            AddonSearchResultFile latestFile = null;
            foreach(var result in searchResults)
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
            WowClientType clientType)
        {
            if(latestFile == null)
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
                ChannelType = latestFile.ChannelType
            };
        }
    }
}
