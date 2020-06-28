using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Threading.Tasks;
using Windows.Storage;
using WowUp.Models;
using WowUp.Services;
using WowUp.Utilities;
using Xamarin.Forms;

[assembly: Dependency(typeof(WowUp.UWP.Services.WarcraftService))]
namespace WowUp.UWP.Services
{
    public class WarcraftService : IWarcraftService
    {
        private const string WowFolderMruKey = "WoW Folder";

        private const string ClassicFolderName = "_classic_";
        private const string RetailFolderName = "_retail_";
        
        private const string InterfaceFolderName = @"Interface";

        private const string RetailAddonFolderName = @"AddOns";
        private const string ClassicAddonFolderName = @"Addons";

        private IEnumerable<AddonFolder> _retailAddonCache = null;
        private IEnumerable<AddonFolder> _classicAddonCache = null;

        public async Task<string> GetWowFolderPath()
        {
            var folder = await GetWowFolder();

            return folder?.Path;
        }

        public async Task<string> GetRetailFolderPath()
        {
            var folder = await GetRetailFolder();

            return folder?.Path;
        }

        public async Task<string> GetAddonDirectory(WowClientType clientType)
        {
            return clientType == WowClientType.Retail
                ? await GetRetailAddonFolderPath()
                : await GetClassicAddonFolderPath();
        }

        public async Task<string> GetRetailAddonFolderPath()
        {
            var retailfolder = await GetRetailFolder();
            var interfaceFolder = await retailfolder.GetFolderAsync(InterfaceFolderName);
            var addonFolder = await interfaceFolder.GetFolderAsync(RetailAddonFolderName);

            var fullPath = addonFolder.Path;

            return fullPath;
        }

        public async Task<string> GetClassicFolderPath()
        {
            var folder = await GetClassicFolder();

            return folder?.Path;
        }

        public async Task<string> GetClassicAddonFolderPath()
        {
            var folder = await GetClassicFolder();

            return Path.Combine(folder?.Path, InterfaceFolderName, ClassicAddonFolderName);
        }

        public async Task<string> SelectWowFolder()
        {
            var folder = await UwpFileService.SelectFolder(WowFolderMruKey);

            return folder?.Path;
        }

        private async Task<StorageFolder> GetWowFolder()
        {
            return await UwpFileService.GetFolder(WowFolderMruKey);
        }

        private async Task<StorageFolder> GetRetailFolder()
        {
            var wowFolder = await GetWowFolder();
            return await wowFolder.GetFolderAsync(RetailFolderName);
        }

        private async Task<StorageFolder> GetClassicFolder()
        {
            var wowFolder = await GetWowFolder();
            return await wowFolder.GetFolderAsync(ClassicFolderName);
        }

        public async Task<IEnumerable<AddonFolder>> ListRetailAddons(bool forceReload = false)
        {
            if(!forceReload && _retailAddonCache != null)
            {
                return _retailAddonCache;
            }

            var retailFolder = await GetRetailFolder();
            var interfaceFolder = await retailFolder.GetFolderAsync("Interface");
            var addonsFolder = await interfaceFolder.GetFolderAsync("AddOns");
            var addonFolders = await addonsFolder.GetFoldersAsync();

            var addons = new List<AddonFolder>();
            foreach(var folder in addonFolders)
            {
                var addonFolder = await GetAddonFolder(folder);
                addons.Add(addonFolder);
            }

            addons = FitlerAddons(addons).ToList();

            _retailAddonCache = addons;

            return addons;
        }

        public async Task<IEnumerable<AddonFolder>> ListClassicAddons(bool forceReload = false)
        {
            if (!forceReload && _classicAddonCache != null)
            {
                return _classicAddonCache;
            }

            var classicFolder = await GetClassicFolder();
            var interfaceFolder = await classicFolder.GetFolderAsync("Interface");
            var addonsFolder = await interfaceFolder.GetFolderAsync("Addons");
            var addonFolders = await addonsFolder.GetFoldersAsync();

            var addons = new List<AddonFolder>();
            foreach (var folder in addonFolders)
            {
                var addonFolder = await GetAddonFolder(folder);
                addons.Add(addonFolder);
            }

            addons = FitlerAddons(addons).ToList();

            _classicAddonCache = addons;

            return addons;
        }

        private async Task<AddonFolder> GetAddonFolder(StorageFolder folder)
        {
            var toc = await ParseToc(folder);

            return new AddonFolder
            {
                Name = folder.Name,
                Path = folder.Path,
                Status = "Pending",
                Toc = toc
            };
        }

        private async Task<Toc> ParseToc(StorageFolder folder)
        {
            var files = await folder.GetFilesAsync();
            foreach(var file in files)
            {
                if (!file.Name.EndsWith(".toc"))
                {
                    continue;
                }

                var fileText = await FileIO.ReadTextAsync(file);
                return new TocParser(fileText).Toc;
            }

            return null;
        }

        private IEnumerable<AddonFolder> FitlerAddons(IEnumerable<AddonFolder> addons)
        {
            return addons.Where(addon => !string.IsNullOrEmpty(addon.Toc?.Title));
        }
    }
}
