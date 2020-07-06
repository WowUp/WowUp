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
using WowUp.WPF.Extensions;

namespace WowUp.WPF.Services
{
    public class WarcraftService : IWarcraftService
    {
        private const string ClassicFolderName = "_classic_";
        private const string ClassicPtrFolderName = "_classic_ptr_";
        
        private const string RetailFolderName = "_retail_";
        private const string RetailPtrFolderName = "_ptr_";

        private const string InterfaceFolderName = @"Interface";
        private const string AddonFolderName = @"AddOns";

        private const string WowLocationPreferenceKey = "wow_location";

        private static readonly string[] FolderNames = new[] { ClassicFolderName, ClassicPtrFolderName, RetailFolderName, RetailPtrFolderName };

        private readonly IPreferenceRepository _preferenceRepository;

        public WarcraftService(
            IPreferenceRepository preferenceRepository)
        {
            _preferenceRepository = preferenceRepository;
        }

        public async Task<IList<string>> GetWowClientNames()
        {
            var clients = await GetWowClients();
            var clientNames = new List<string>();

            foreach(var client in clients)
            {
                var clientDisplay = client.GetDisplayName();
                clientNames.Add(clientDisplay);
            }

            return clientNames;
        }

        public async Task<IList<WowClientType>> GetWowClients()
        {
            var clients = new List<WowClientType>();
            var wowFolder = await GetWowFolderPath();
            if (string.IsNullOrEmpty(wowFolder))
            {
                return clients;
            }

            var clientTypes = Enum.GetValues(typeof(WowClientType)).Cast<WowClientType>();
            foreach(var clientType in clientTypes)
            {
                var hasClient = await HasClient(clientType);
                if (hasClient)
                {
                    clients.Add(clientType);
                }
            }

            return clients;
        }

        public async Task<bool> HasClient(WowClientType clientType)
        {
            var wowFolder = await GetWowFolderPath();
            var clientFolder = GetClientFolderName(clientType);
            var clientPath = Path.Combine(wowFolder, clientFolder);

            return Directory.Exists(clientPath);
        }

        public async Task<string> GetClassicFolderPath()
        {
            var wowPath = await GetWowFolderPath();
            var path = Path.Combine(wowPath, ClassicFolderName);
            return path;
        }

        public async Task<string> GetAddonFolderPath(WowClientType clientType)
        {
            var wowPath = await GetWowFolderPath();
            var clientFolder = GetClientFolderName(clientType);

            return Path.Combine(wowPath, clientFolder, InterfaceFolderName, AddonFolderName);
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

        public async Task<IEnumerable<AddonFolder>> ListAddons(WowClientType clientType)
        {
            var addonsPath = await GetAddonFolderPath(clientType);

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

        private Preference GetWowLocationPreference()
        {
            return _preferenceRepository.FindByKey(WowLocationPreferenceKey);
        }

        private bool ValidateWowFolder(string wowFolder)
        {
            try
            {
                var directories = Directory.GetDirectories(wowFolder);
                return directories.Any(dir => FolderNames.Any(fn => dir.Contains(fn)));
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

        private string GetClientFolderName(WowClientType clientType)
        {
            return clientType switch
            {
                WowClientType.Retail => RetailFolderName,
                WowClientType.Classic => ClassicFolderName,
                WowClientType.RetailPtr => RetailPtrFolderName,
                WowClientType.ClassicPtr => ClassicPtrFolderName,
                _ => string.Empty,
            };
        }
    }
}
