using ProtoBuf;
using Serilog;
using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Threading.Tasks;
using WowUp.Common.Enums;
using WowUp.Common.Extensions;
using WowUp.Common.Models;
using WowUp.Common.Models.Events;
using WowUp.Common.Models.Warcraft;
using WowUp.WPF.Entities;
using WowUp.WPF.Models.WowUp;
using WowUp.WPF.Repositories.Contracts;
using WowUp.WPF.Services.Contracts;
using WowUp.WPF.Utilities;

namespace WowUp.WPF.Services
{
    public class WarcraftService : IWarcraftService
    {
        // WOW STRINGS
        private const string ClassicFolderName = "_classic_";
        private const string ClassicPtrFolderName = "_classic_ptr_";
        private const string RetailFolderName = "_retail_";
        private const string RetailPtrFolderName = "_ptr_";
        private const string BetaFolderName = "_beta_";
        private const string InterfaceFolderName = "Interface";
        private const string AddonFolderName = "AddOns";
        private const string BetaExecutableName = "WowB.exe";
        private const string RetailExecutableName = "Wow.exe";
        private const string RetailPtrExecutableName = "WowT.exe";
        private const string ClassicExecutableName = "WowClassic.exe";
        private const string ClassicPtrExecutableName = "WowClassicT.exe";

        // BLIZZARD STRINGS
        private const string BlizzardAgentFolderFormat = "ProgramData\\Battle.net\\Agent";
        private const string BlizzardProductDbName = "product.db";

        // PREFERENCE KEYS
        private const string WowRetailLocationPreferenceKey = "wow_retail_location";
        private const string WowRetailPtrLocationPreferenceKey = "wow_retail_ptr_location";
        private const string WowClassicLocationPreferenceKey = "wow_classic_location";
        private const string WowClassicPtrLocationPreferenceKey = "wow_classic_ptr_location";
        private const string WowBetaLocationPreferenceKey = "wow_beta_location";

        private readonly IPreferenceRepository _preferenceRepository;

        public event WarcraftEventHandler ProductChanged;

        public IList<InstalledProduct> InstalledProducts { get; private set; }

        public string ProductsDbPath => Path.Combine(GetBlizzardAgentPath(), BlizzardProductDbName);

        public WarcraftService(
            IPreferenceRepository preferenceRepository)
        {
            _preferenceRepository = preferenceRepository;
            SetDefaultPreferences();

            ScanProducts();
        }

        public IList<InstalledProduct> ScanProducts()
        {
            InstalledProducts = DecodeProducts(ProductsDbPath);

            var clientTypes = EnumExtensions.Values<WowClientType>();
            foreach (var clientType in clientTypes)
            {
                var clientLocation = GetClientLocation(clientType);
                var productLocation = GetProductLocation(clientType);

                if(string.IsNullOrEmpty(clientLocation) && string.IsNullOrEmpty(productLocation))
                {
                    continue;
                }

                Log.Information($"clientLocation {clientLocation}, productLocation: {productLocation}");
                if (AreEqualPaths(clientLocation, productLocation))
                {
                    continue;
                }

                // If the path that the user selected is valid, then move on.
                if (!string.IsNullOrEmpty(clientLocation) && IsClientFolder(clientType, clientLocation))
                {
                    continue;
                }

                var locationPreference = GetClientLocationPreference(clientType);
                if (locationPreference == null)
                {
                    locationPreference = _preferenceRepository.Create(GetClientLocationPreferenceKey(clientType), string.Empty);
                }

                locationPreference.Value = productLocation;

                Log.Information($"locationPreference {locationPreference}");

                _preferenceRepository.SaveItem(locationPreference);

                var changedClient = new ChangedClient
                {
                    ClientType = clientType,
                    NewLocation = productLocation,
                    PreviousLocation = clientLocation
                };

                ProductChanged?.Invoke(this, new WarcraftEventArgs
                {
                    ChangedClient = changedClient
                });
            }

            return InstalledProducts;
        }

        private bool AreEqualPaths(string path1, string path2)
        {
            if (string.IsNullOrEmpty(path1) && string.IsNullOrEmpty(path2))
            {
                return true;
            }
            if (string.IsNullOrEmpty(path1) && !string.IsNullOrEmpty(path2))
            {
                return false;
            }
            if (string.IsNullOrEmpty(path2) && !string.IsNullOrEmpty(path1))
            {
                return false;
            }

            return Path.GetFullPath(path1) == Path.GetFullPath(path2);
        }

        public IList<string> GetWowClientNames()
        {
            var clients = GetWowClientTypes();
            return clients
                .Select(c => c.GetDisplayName())
                .ToList();
        }

        public string GetClientLocation(WowClientType clientType)
        {
            var preference = GetClientLocationPreference(clientType);
            return preference?.Value ?? string.Empty;
        }

        private Preference GetClientLocationPreference(WowClientType clientType)
        {
            var preferenceKey = GetClientLocationPreferenceKey(clientType);
            return _preferenceRepository.FindByKey(preferenceKey);
        }

        public IList<string> GetClientLocations()
        {
            var clientTypes = EnumExtensions.Values<WowClientType>();
            return clientTypes.Select(clientType => GetClientLocation(clientType)).ToList();
        }

        public IList<WowClientType> GetWowClientTypes()
        {
            IList<WowClientType> clients = new List<WowClientType>();

            var clientTypes = EnumExtensions.Values<WowClientType>();
            foreach (var clientType in clientTypes)
            {
                var clientLocation = GetClientLocation(clientType);
                if (string.IsNullOrEmpty(clientLocation) || !Directory.Exists(clientLocation))
                {
                    continue;
                }

                clients.Add(clientType);
            }

            return clients;
        }

        public bool IsClientFolder(WowClientType clientType, string folderPath)
        {
            var clientFolderName = GetClientFolderName(clientType);
            var executableName = GetExecuteableName(clientType);
            var executablePath = Path.Combine(folderPath, clientFolderName, executableName);

            return File.Exists(executablePath);
        }

        public string GetAddonFolderPath(WowClientType clientType)
        {
            var wowPath = GetClientLocation(clientType);
            var clientFolder = GetClientFolderName(clientType);
            var executableFolder = Path.Combine(wowPath, clientFolder);

            if (!Directory.Exists(executableFolder))
            {
                throw new Exception($"Wow client folder not found {executableFolder}");
            }

            return Path.Combine(executableFolder, InterfaceFolderName, AddonFolderName);
        }

        public bool SetWowFolderPath(WowClientType clientType, string folderPath)
        {
            if (!IsClientFolder(clientType, folderPath))
            {
                return false;
            }

            var preferenceKey = GetClientLocationPreferenceKey(clientType);
            var preference = _preferenceRepository.FindByKey(preferenceKey);
            if (preference == null)
            {
                throw new Exception("client preference key not found");
            }

            preference.Value = folderPath;
            _preferenceRepository.UpdateItem(preference);

            return true;
        }

        public async Task<IEnumerable<AddonFolder>> ListAddons(WowClientType clientType)
        {
            if(clientType == WowClientType.None)
            {
                return new List<AddonFolder>();
            }

            var addons = new List<AddonFolder>();

            var addonsPath = GetAddonFolderPath(clientType);
            var addonsDirectory = new DirectoryInfo(addonsPath);

            // Folder may not exist if no addons have been installed
            if (!addonsDirectory.Exists)
            {
                return addons;
            }

            var addonDirectories = addonsDirectory.GetDirectories();
            Log.Debug($"addonDirectories {addonDirectories.Length}");

            foreach (var directory in addonDirectories)
            {
                Log.Debug($"Getting addon folder {directory.Name}");
                var addonFolder = await GetAddonFolder(directory);
                addons.Add(addonFolder);
            }

            return addons;
        }

        public string GetClientFolderName(WowClientType clientType)
        {
            return clientType switch
            {
                WowClientType.Retail => RetailFolderName,
                WowClientType.Classic => ClassicFolderName,
                WowClientType.RetailPtr => RetailPtrFolderName,
                WowClientType.ClassicPtr => ClassicPtrFolderName,
                WowClientType.Beta => BetaFolderName,
                _ => string.Empty,
            };
        }

        private async Task<AddonFolder> GetAddonFolder(DirectoryInfo directory)
        {
            var toc = await ParseToc(directory);
            //var tocMetaData = await ParseTocMetadata(directory);

            return new AddonFolder
            {
                Directory = directory,
                Name = directory.Name,
                Path = directory.FullName,
                Status = "Pending",
                Toc = toc,
                //TocMetaData = tocMetaData
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

        private async Task<IList<string>> ParseTocMetadata(DirectoryInfo directory)
        {
            var files = directory.GetFiles();
            var tocFile = files.FirstOrDefault(f => f.Extension.Contains("toc"));
            if (tocFile == null)
            {
                return default;
            }

            var fileText = await FileUtilities.GetFileTextAsync(tocFile.FullName);
            return new TocParser(fileText).GetMetaData();
        }

        private string GetClientLocationPreferenceKey(WowClientType clientType)
        {
            return clientType switch
            {
                WowClientType.Retail => WowRetailLocationPreferenceKey,
                WowClientType.Classic => WowClassicLocationPreferenceKey,
                WowClientType.RetailPtr => WowRetailPtrLocationPreferenceKey,
                WowClientType.ClassicPtr => WowClassicPtrLocationPreferenceKey,
                WowClientType.Beta => WowBetaLocationPreferenceKey,
                _ => string.Empty,
            };
        }

        private string GetExecuteableName(WowClientType clientType)
        {
            return clientType switch
            {
                WowClientType.Retail => RetailExecutableName,
                WowClientType.Classic => ClassicExecutableName,
                WowClientType.RetailPtr => RetailPtrExecutableName,
                WowClientType.ClassicPtr => ClassicPtrExecutableName,
                WowClientType.Beta => BetaExecutableName,
                _ => string.Empty,
            };
        }

        private string GetBlizzardAgentPath()
        {
            var driveLetters = FileUtilities.GetAllDriveLetters();
            Log.Debug($"Drives: {string.Join(",", driveLetters)}");

            foreach (var drive in driveLetters)
            {
                var agentPath = Path.Combine(drive, BlizzardAgentFolderFormat);
                Log.Debug($"Searching for blizzard agent: {agentPath}");

                if (Directory.Exists(agentPath))
                {
                    return agentPath;
                }
            }

            Log.Debug("No blizzard agent path was found");
            return string.Empty;
        }

        private IList<InstalledProduct> DecodeProducts(string productDbPath)
        {
            var products = new List<InstalledProduct>();

            try
            {
                using var fileStream = File.OpenRead(productDbPath);
                var productDb = Serializer.Deserialize<ProductDb>(fileStream);

                var installedProducts = productDb.Products
                    .Where(p => p.Family == "wow")
                    .Select(p => new InstalledProduct
                    {
                        Location = p.Client.Location,
                        Name = p.Client.Name
                    });

                products.AddRange(installedProducts);
            }
            catch (Exception ex)
            {
                Log.Error(ex, "Failed to decode product db");
            }

            return products;
        }

        private string GetProductLocation(WowClientType clientType)
        {
            var clientFolderName = GetClientFolderName(clientType);

            var clientLocation = InstalledProducts.FirstOrDefault(p => p.Name == clientFolderName);

            return clientLocation?.Location ?? string.Empty;
        }

        private void SetDefaultPreferences()
        {
            var retailLocation = _preferenceRepository.FindByKey(WowRetailLocationPreferenceKey);
            var retailPtrLocation = _preferenceRepository.FindByKey(WowRetailPtrLocationPreferenceKey);
            var classicLocation = _preferenceRepository.FindByKey(WowClassicLocationPreferenceKey);
            var classicPtrLocation = _preferenceRepository.FindByKey(WowClassicPtrLocationPreferenceKey);

            if (retailLocation == null)
            {
                _preferenceRepository.Create(WowRetailLocationPreferenceKey, string.Empty);
            }

            if (retailPtrLocation == null)
            {
                _preferenceRepository.Create(WowRetailPtrLocationPreferenceKey, string.Empty);
            }

            if (classicLocation == null)
            {
                _preferenceRepository.Create(WowClassicLocationPreferenceKey, string.Empty);
            }

            if (classicPtrLocation == null)
            {
                _preferenceRepository.Create(WowClassicPtrLocationPreferenceKey, string.Empty);
            }
        }
    }
}
