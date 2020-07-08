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

namespace WowUp.WPF.Services
{
    public class AddonService : IAddonService
    {
        protected const string DownloadFolder = "AddonDownloads";
        protected const string BackupFolder = "AddonBackups";

        protected readonly Dictionary<string, string> _addonNameOverrides = new Dictionary<string, string>
        {
            ["Ask Mr. Robot"] = "askmrrobot"
        };

        protected readonly IEnumerable<IAddonProvider> _providers = new List<IAddonProvider>();

        protected readonly IAddonRepository _addonRepository;
        protected readonly IDownloadSevice _downloadService;
        protected readonly IWarcraftService _warcraftService;

        public string DownloadPath => Path.Combine(FileUtilities.AppDataPath, DownloadFolder);
        public string BackupPath => Path.Combine(FileUtilities.AppDataPath, BackupFolder);

        public AddonService(
            IServiceProvider serviceProvider,
            IAddonRepository addonRepository,
            IDownloadSevice downloadSevice,
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

        public Addon GetAddon(int addonId)
        {
            return _addonRepository.Query(table => table.FirstOrDefault(a => a.Id == addonId));
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
            var addonIds = addons.Select(addon => addon.CurseAddonId);
            try
            {
                var addonTasks = _providers.Select(p => p.GetAll(clientType, addonIds));
                var addonResults = await Task.WhenAll(addonTasks);
                var addonResultsConcat = addonResults.SelectMany(res => res);

                foreach (var addon in addons)
                {
                    var match = addonResultsConcat.FirstOrDefault(a => a.ExternalId == addon.CurseAddonId);
                    if (match == null || match.Version == addon.LatestVersion)
                    {
                        continue;
                    }

                    addon.LatestVersion = match.Version;
                    addon.Name = match.Name;
                    addon.Author = match.Author;
                    addon.DownloadUrl = match.DownloadUrl;
                    addon.GameVersion = match.GameVersion;
                    addon.ThumbnailUrl = match.ThumbnailUrl;
                    addon.ExternalUrl = match.ExternalUrl;

                    _addonRepository.UpdateItem(addon);
                }
            }
            catch(Exception ex)
            {
                Log.Error(ex, "Failed to sync addons");
            }
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
                downloadedFilePath = await _downloadService.DownloadFile(addon.DownloadUrl, DownloadPath);

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
                _addonRepository.UpdateItem(addon);
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

        private async Task InstallUnzippedDirectory(string unzippedDirectory, WowClientType clientType)
        {
            var addonFolderPath = await _warcraftService.GetAddonFolderPath(clientType);
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
            if (!Directory.Exists(DownloadPath))
            {
                Directory.CreateDirectory(DownloadPath);
            }

            if (!Directory.Exists(BackupPath))
            {
                Directory.CreateDirectory(BackupPath);
            }
        }

        private async Task<List<Addon>> RescanAddons(List<Addon> addons, WowClientType clientType)
        {
            var localAddons = await GetLocalAddons(clientType);

            foreach (var localAddon in localAddons)
            {
                var addon = addons.FirstOrDefault(a => a.Name == localAddon.Name);
                if (addon != null)
                {
                    addon.LatestVersion = localAddon.LatestVersion;
                    addon.ThumbnailUrl = localAddon.ThumbnailUrl;
                    addon.Author = localAddon.Author;
                    addon.CurseAddonId = localAddon.CurseAddonId;
                    addon.FolderName = localAddon.FolderName;
                    addon.GameVersion = localAddon.GameVersion;
                    addon.DownloadUrl = localAddon.DownloadUrl;
                    addon.ExternalUrl = localAddon.ExternalUrl;

                    _addonRepository.UpdateItem(addon);
                }
                else
                {
                    addons.Add(localAddon);

                    _addonRepository.AddItem(localAddon);
                }
            }

            return addons;
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

        public async Task<List<Addon>> MapAll(IEnumerable<Addon> addons, WowClientType clientType)
        {
            if (addons == null)
            {
                Log.Warning("Addon list was null");
                return new List<Addon>();
            }

            foreach (var addon in addons)
            {
                Log.Debug($"Addon {addon.FolderName}");

                try
                {
                    var searchResults = await Search(addon.Name, addon.FolderName, clientType);
                    var firstResult = searchResults.FirstOrDefault();
                    if (firstResult == null)
                    {
                        continue;
                    }

                    addon.LatestVersion = firstResult.Version;
                    addon.GameVersion = firstResult.GameVersion;
                    addon.Author = firstResult.Author;
                }
                catch (Exception ex)
                {
                    Log.Error(ex, "Failed to map addon");
                }
            }

            return addons.ToList();
        }

        public async Task<List<Addon>> MapAll(IEnumerable<AddonFolder> addonFolders, WowClientType clientType)
        {
            var results = new Dictionary<string, Addon>();

            foreach (var addonFolder in addonFolders)
            {
                try
                {
                    var addon = await Map(addonFolder.Toc.Title, addonFolder.Name, clientType);
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
            var firstResult = searchResults.FirstOrDefault();
            if (firstResult == null)
            {
                return null;
            }

            return GetAddon(folderName, firstResult, clientType);
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

        private Addon GetAddon(
            string folderName,
            AddonSearchResult searchResult,
            WowClientType clientType)
        {
            return new Addon
            {
                Name = searchResult.Name,
                ThumbnailUrl = searchResult.ThumbnailUrl,
                LatestVersion = searchResult.Version,
                ClientType = clientType,
                CurseAddonId = searchResult.ExternalId,
                FolderName = folderName,
                GameVersion = searchResult.GameVersion,
                Author = searchResult.Author,
                DownloadUrl = searchResult.DownloadUrl,
                ExternalUrl = searchResult.ExternalUrl
            };
        }
    }
}
