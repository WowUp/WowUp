using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Threading.Tasks;
using WowUp.WPF.Models;
using WowUp.WPF.Services.Base;
using WowUp.WPF.Services.Contracts;
using WowUp.WPF.Utilities;

namespace WowUp.WPF.Services
{
    public class WarcraftService : SingletonService<WarcraftService>, IWarcraftService
    {
        public WarcraftService()
        {
        }

        private const string ClassicFolderName = "_classic_";
        private const string RetailFolderName = "_retail_";

        private const string InterfaceFolderName = @"Interface";

        private const string RetailAddonFolderName = @"AddOns";
        private const string ClassicAddonFolderName = @"Addons";

        public Task<string> GetAddonDirectory(WowClientType clientType)
        {
            return clientType == WowClientType.Retail
                ? GetRetailAddonFolderPath()
                : GetClassicAddonFolderPath();
        }

        public async Task<string> GetClassicAddonFolderPath()
        {
            var classicPath = await GetClassicFolderPath();
            var path = Path.Combine(classicPath, InterfaceFolderName, ClassicAddonFolderName);
            return path;
        }

        public async Task<string> GetClassicFolderPath()
        {
            var wowPath = await GetWowFolderPath();
            var path = Path.Combine(wowPath, ClassicFolderName);
            return path;
        }

        public async Task<string> GetRetailAddonFolderPath()
        {
            var retailPath = await GetRetailFolderPath();
            var path = Path.Combine(retailPath, InterfaceFolderName, RetailAddonFolderName);
            return path;
        }

        public async Task<string> GetRetailFolderPath()
        {
            var wowPath = await GetWowFolderPath();
            var path = Path.Combine(wowPath, RetailFolderName);
            return path;
        }

        public Task<string> GetWowFolderPath()
        {
            return Task.FromResult(@"C:\Program Files (x86)\World of Warcraft");
        }

        public Task<IEnumerable<AddonFolder>> ListClassicAddons(bool forceReload = false)
        {
            return ListAddons(WowClientType.Classic);
        }

        public Task<IEnumerable<AddonFolder>> ListRetailAddons(bool forceReload = false)
        {
            return ListAddons(WowClientType.Retail);
        }

        private async Task<IEnumerable<AddonFolder>> ListAddons(WowClientType clientType)
        {
            var addonsPath = clientType == WowClientType.Retail
                ? await GetRetailAddonFolderPath()
                : await GetClassicAddonFolderPath();

            var addons = new List<AddonFolder>();
            var addonDirectories = Directory.GetDirectories(addonsPath);
            foreach (var directory in addonDirectories)
            {
                var directoryInfo = new DirectoryInfo(directory);
                var addonFolder = await GetAddonFolder(directoryInfo);
                addons.Add(addonFolder);
            }

            return addons;
        }

        public Task<string> SelectWowFolder()
        {
            throw new NotImplementedException();
        }

        private async Task<AddonFolder> GetAddonFolder(DirectoryInfo directory)
        {
            var toc = await ParseToc(directory);

            return new AddonFolder
            {
                Name = directory.Name,
                Path = directory.FullName,
                Status = "Pending",
                Toc = toc
            };
        }

        private async Task<Toc> ParseToc(DirectoryInfo directory)
        {
            var files = directory.GetFiles();
            var tocFile = files.FirstOrDefault(f => f.Extension.Contains("toc"));
            if (tocFile == null)
            {
                return default;
            }

            var fileText = await FileUtilities.GetFileTextAsync(tocFile.FullName);
            return new TocParser(fileText).Toc;
        }
    }
}
