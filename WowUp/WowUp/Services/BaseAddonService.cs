using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Threading.Tasks;
using WowUp.AddonProviders;
using WowUp.Entities;
using WowUp.Models;
using Xamarin.Forms;

namespace WowUp.Services
{
    public class BaseAddonService : IAddonService
    {
        protected const string DownloadFolder = "AddonDownloads";
        protected const string BackupFolder = "AddonBackups";

        protected readonly Dictionary<string, string> _addonNameOverrides = new Dictionary<string, string>
        {
            ["Ask Mr. Robot"] = "askmrrobot"
        };
        protected readonly IEnumerable<IAddonProvider> _providers = new List<IAddonProvider>();

        protected readonly IDataStore<Addon> _addonDataStore = DependencyService.Get<IDataStore<Addon>>();
        protected readonly IWarcraftService _warcraftService = DependencyService.Get<IWarcraftService>();
        protected readonly IDownloadSevice _downloadService = DependencyService.Get<IDownloadSevice>();

        public virtual string DownloadPath => throw new NotImplementedException();
        public virtual string BackupPath => throw new NotImplementedException();

        public BaseAddonService()
        {
            _providers = new List<IAddonProvider>
            {
                new CurseAddonProvider()
            };

            InitializeDirectories();
        }

        public Addon GetAddon(int addonId)
        {
            return _addonDataStore.Query(table => table.FirstOrDefault(a => a.Id == addonId));
        }

        
        public async Task<List<Addon>> GetAddons(WowClientType clientType, bool rescan = false)
        {
            var addons = GetAllStoredAddons(clientType);
            if (!addons.Any())
            {
                addons = await GetLocalAddons(clientType);
                SaveAddons(addons);
            } 
            else if (rescan)
            {
                addons = await RescanAddons(addons, clientType);
            }

            return addons;
        }

        public async Task InstallAddon(int addonId, Action<AddonInstallState, decimal> updateAction)
        {
            var addon = GetAddon(addonId);
            if(addon == null || string.IsNullOrEmpty(addon.DownloadUrl))
            {
                throw new Exception("Addon not found or invalid");
            }

            updateAction?.Invoke(AddonInstallState.Downloading, 0.25m);

            var downloadedFilePath = await _downloadService.DownloadFile(addon.DownloadUrl, DownloadPath);

            if (!string.IsNullOrEmpty(addon.InstalledVersion))
            {
                updateAction?.Invoke(AddonInstallState.BackingUp, 0.50m);
                var backupZipFilePath = Path.Combine(BackupPath, $"{addon.Name}-{addon.InstalledVersion}.zip");
                await _downloadService.ZipFile(downloadedFilePath, backupZipFilePath);
            }
            
            updateAction?.Invoke(AddonInstallState.Installing, 0.75m);

            var addonFolderPath = await _warcraftService.GetAddonDirectory(addon.ClientType);
            await _downloadService.UnzipFile(downloadedFilePath, addonFolderPath);

            addon.InstalledVersion = addon.LatestVersion;
            addon.InstalledAt = DateTime.UtcNow;
            _addonDataStore.UpdateItem(addon);

            File.Delete(downloadedFilePath);

            updateAction?.Invoke(AddonInstallState.Complete, 1.0m);
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

            foreach(var localAddon in localAddons)
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

                    _addonDataStore.UpdateItem(addon);
                }
                else
                {
                    addons.Add(localAddon);

                    _addonDataStore.AddItem(localAddon);
                }
            }

            return addons;
        }

        private List<Addon> GetAllStoredAddons(WowClientType clientType)
        {
            return _addonDataStore.Query(table => table.Where(a => a.ClientType == clientType)).ToList();
        }

        private void SaveAddons(IEnumerable<Addon> addons)
        {
            _addonDataStore.AddItems(addons);
        }

        private async Task<List<Addon>> GetLocalAddons(WowClientType clientType)
        {
            var addonFolders = await GetAddonFolders(clientType);
            return await MapAll(addonFolders, clientType);
        }

        private async Task<IEnumerable<AddonFolder>> GetAddonFolders(WowClientType clientType)
        {
            return clientType == WowClientType.Retail
                ? await _warcraftService.ListRetailAddons(false)
                : await _warcraftService.ListClassicAddons(false);
        }

        public async Task<List<Addon>> MapAll(IEnumerable<Addon> addons, WowClientType clientType)
        {
            foreach (var addon in addons)
            {
                var searchResults = await Search(addon.Name, addon.FolderName, clientType);
                var firstResult = searchResults.FirstOrDefault();
                if (firstResult == null)
                {
                    return null;
                }

                addon.LatestVersion = firstResult.Version;
                addon.GameVersion = firstResult.GameVersion;
                addon.Author = firstResult.Author;
            }

            return addons.ToList();
        }

        public async Task<List<Addon>> MapAll(IEnumerable<AddonFolder> addonFolders, WowClientType clientType)
        {
            var results = new Dictionary<string, Addon>();

            foreach(var addonFolder in addonFolders)
            {
                var addon = await Map(addonFolder.Toc.Title, addonFolder.Name, clientType);
                if(addon == null)
                {
                    continue;
                }

                results[addon.Name] = addon;
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
                DownloadUrl = searchResult.DownloadUrl
            };
        }
    }
}
