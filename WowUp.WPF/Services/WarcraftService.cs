using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Threading.Tasks;
using System.Windows.Forms;
using WowUp.WPF.Entities;
using WowUp.WPF.Models;
using WowUp.WPF.Repositories.Contracts;
using WowUp.WPF.Services.Contracts;
using WowUp.WPF.Utilities;

namespace WowUp.WPF.Services
{
    public class WarcraftService : IWarcraftService
    {
        private const string ClassicFolderName = "_classic_";
        private const string RetailFolderName = "_retail_";

        private const string InterfaceFolderName = @"Interface";

        private const string RetailAddonFolderName = @"AddOns";
        private const string ClassicAddonFolderName = @"Addons";

        private const string WowLocationPreferenceKey = "wow_location";

        private readonly IPreferenceRepository _preferenceRepository;

        public WarcraftService(
            IPreferenceRepository preferenceRepository)
        {
            _preferenceRepository = preferenceRepository;
        }

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
            var preference = GetWowLocationPreference();
            return Task.FromResult(preference?.Value);
        }
        
        public Task<bool> SetWowFolderPath(string folderPath)
        {
            if (!ValidateWowFolder(folderPath))
            {
                return Task.FromResult(false);
            }

            var preference = GetWowLocationPreference();
            if(preference == null)
            {
                preference = new Preference
                {
                    Key = WowLocationPreferenceKey
                };
            }

            preference.Value = folderPath;
            _preferenceRepository.UpdateItem(preference);

            return Task.FromResult(true);
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

        public async Task<string> SelectWowFolder()
        {
            using var dialog = new FolderBrowserDialog();
            var result = dialog.ShowDialog();

            return "";
        }
        
        private Preference GetWowLocationPreference()
        {
            return _preferenceRepository.FindByKey(WowLocationPreferenceKey);
        }

        private bool ValidateWowFolder(string wowFolder)
        {
            try
            {
                var directories = Directory.GetDirectories(wowFolder);
                return directories.Any(dir => dir.Contains(ClassicFolderName) || dir.Contains(RetailFolderName));
            }
            catch(Exception ex)
            {
                return false;
            }
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
