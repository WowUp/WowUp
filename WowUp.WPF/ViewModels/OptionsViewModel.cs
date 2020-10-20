using System;
using System.Collections.Generic;
using System.Collections.ObjectModel;
using System.IO;
using System.Linq;
using System.ServiceModel.Channels;
using System.Text;
using System.Threading.Tasks;
using System.Windows;
using WowUp.Common.Enums;
using WowUp.WPF.AddonProviders.Contracts;
using WowUp.WPF.Services.Contracts;
using WowUp.WPF.Utilities;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Win32;
using Serilog;
using WowUp.Common.Exceptions;
using WowUp.Common.Extensions;
using WowUp.Common.Models;
using WowUp.WPF.Services;
using WowUp.WPF.Views;

namespace WowUp.WPF.ViewModels
{
    public class OptionsViewModel : BaseViewModel
    {
        private readonly IAddonService _addonService;
        private readonly IAnalyticsService _analyticsService;
        private readonly IServiceProvider _serviceProvider;
        private readonly IWarcraftService _warcraftService;
        private readonly IWowUpService _wowUpService;

        private string _wowRetailLocation;

        public string WowRetailLocation
        {
            get => _wowRetailLocation;
            set { SetProperty(ref _wowRetailLocation, value); }
        }

        private string _wowRetailPtrLocation;

        public string WowRetailPtrLocation
        {
            get => _wowRetailPtrLocation;
            set { SetProperty(ref _wowRetailPtrLocation, value); }
        }

        private string _wowClassicLocation;

        public string WowClassicLocation
        {
            get => _wowClassicLocation;
            set { SetProperty(ref _wowClassicLocation, value); }
        }

        private string _wowClassicPtrLocation;

        public string WowClassicPtrLocation
        {
            get => _wowClassicPtrLocation;
            set { SetProperty(ref _wowClassicPtrLocation, value); }
        }

        private string _wowBetaLocation;

        public string WowBetaLocation
        {
            get => _wowBetaLocation;
            set { SetProperty(ref _wowBetaLocation, value); }
        }

        private bool _isTelemetryEnabled;

        public bool IsTelemetryEnabled
        {
            get => _isTelemetryEnabled;
            set { SetProperty(ref _isTelemetryEnabled, value); }
        }

        private bool _collapseToTrayEnabled;

        public bool CollapseToTrayEnabled
        {
            get => _collapseToTrayEnabled;
            set { SetProperty(ref _collapseToTrayEnabled, value); }
        }

        private AddonChannelType _selectedRetailAddonChannelType;

        public AddonChannelType SelectedRetailAddonChannelType
        {
            get => _selectedRetailAddonChannelType;
            set { SetProperty(ref _selectedRetailAddonChannelType, value); }
        }

        private AddonChannelType _selectedRetailPtrAddonChannelType;

        public AddonChannelType SelectedRetailPtrAddonChannelType
        {
            get => _selectedRetailPtrAddonChannelType;
            set { SetProperty(ref _selectedRetailPtrAddonChannelType, value); }
        }

        private AddonChannelType _selectedClassicAddonChannelType;

        public AddonChannelType SelectedClassicAddonChannelType
        {
            get => _selectedClassicAddonChannelType;
            set { SetProperty(ref _selectedClassicAddonChannelType, value); }
        }

        private AddonChannelType _selectedClassicPtrAddonChannelType;

        public AddonChannelType SelectedClassicPtrAddonChannelType
        {
            get => _selectedClassicPtrAddonChannelType;
            set { SetProperty(ref _selectedClassicPtrAddonChannelType, value); }
        }

        private AddonChannelType _selectedBetaAddonChannelType;

        public AddonChannelType SelectedBetaAddonChannelType
        {
            get => _selectedBetaAddonChannelType;
            set { SetProperty(ref _selectedBetaAddonChannelType, value); }
        }

        private WowUpReleaseChannelType _selectedWowUpReleaseChannelType;

        public WowUpReleaseChannelType SelectedWowUpReleaseChannelType
        {
            get => _selectedWowUpReleaseChannelType;
            set { SetProperty(ref _selectedWowUpReleaseChannelType, value); }
        }

        private bool _retailAutoUpdateAddons;

        public bool RetailAutoUpdateAddons
        {
            get => _retailAutoUpdateAddons;
            set { SetProperty(ref _retailAutoUpdateAddons, value); }
        }

        private bool _retailPtrAutoUpdateAddons;

        public bool RetailPtrAutoUpdateAddons
        {
            get => _retailPtrAutoUpdateAddons;
            set { SetProperty(ref _retailPtrAutoUpdateAddons, value); }
        }

        private bool _classicAutoUpdateAddons;

        public bool ClassicAutoUpdateAddons
        {
            get => _classicAutoUpdateAddons;
            set { SetProperty(ref _classicAutoUpdateAddons, value); }
        }

        private bool _classicPtrAutoUpdateAddons;

        public bool ClassicPtrAutoUpdateAddons
        {
            get => _classicPtrAutoUpdateAddons;
            set { SetProperty(ref _classicPtrAutoUpdateAddons, value); }
        }

        private bool _betaAutoUpdateAddons;

        public bool BetaAutoUpdateAddons
        {
            get => _betaAutoUpdateAddons;
            set { SetProperty(ref _betaAutoUpdateAddons, value); }
        }

        public Command ShowLogsCommand { get; set; }
        public Command TelemetryCheckCommand { get; set; }
        public Command CollapseToTrayCheckCommand { get; set; }
        public Command SetRetailLocationCommand { get; set; }
        public Command SetRetailPtrLocationCommand { get; set; }
        public Command SetClassicLocationCommand { get; set; }
        public Command SetClassicPtrLocationCommand { get; set; }
        public Command RescanFoldersCommand { get; set; }
        public Command WowUpReleaseChannelChangedCommand { get; set; }
        public Command DumpDebugDataCommand { get; set; }
        public Command ExportAddonListCommand { get; set; }
        public Command ImportAddonListCommand { get; set; }

        // DEFAULT ADDON CHANNELS
        public Command RetailAddonChannelChangeCommand { get; set; }
        public Command RetailPtrAddonChannelChangeCommand { get; set; }
        public Command ClassicAddonChannelChangeCommand { get; set; }
        public Command ClassicPtrAddonChannelChangeCommand { get; set; }
        public Command BetaAddonChannelChangeCommand { get; set; }

        // AUTO UPDATE DEFAULTS
        public Command RetailAutoUpdateChangeCommand { get; set; }
        public Command RetailPtrAutoUpdateChangeCommand { get; set; }
        public Command ClassicAutoUpdateChangeCommand { get; set; }
        public Command ClassicPtrAutoUpdateChangeCommand { get; set; }
        public Command BetaAutoUpdateChangeCommand { get; set; }

        public ObservableCollection<AddonChannelType> AddonChannelNames { get; set; }
        public ObservableCollection<WowUpReleaseChannelType> WowUpChannelNames { get; set; }

        public OptionsViewModel(
            IAnalyticsService analyticsService,
            IAddonService addonService,
            IServiceProvider serviceProvider,
            IWarcraftService warcraftService,
            IWowUpService wowUpService)
        {
            _addonService = addonService;
            _analyticsService = analyticsService;
            _serviceProvider = serviceProvider;
            _warcraftService = warcraftService;
            _wowUpService = wowUpService;

            ShowLogsCommand = new Command(() => ShowLogsFolder());
            TelemetryCheckCommand = new Command(() => OnTelemetryChange());
            CollapseToTrayCheckCommand = new Command(() => OnCollapseToTrayChanged());
            SetRetailLocationCommand = new Command(() => OnSetLocation(WowClientType.Retail));
            SetRetailPtrLocationCommand = new Command(() => OnSetLocation(WowClientType.RetailPtr));
            SetClassicLocationCommand = new Command(() => OnSetLocation(WowClientType.Classic));
            SetClassicPtrLocationCommand = new Command(() => OnSetLocation(WowClientType.ClassicPtr));
            RescanFoldersCommand = new Command(() => OnRescanFolders());
            WowUpReleaseChannelChangedCommand =
                new Command(() => OnWowUpReleaseChannelChange(SelectedWowUpReleaseChannelType));
            DumpDebugDataCommand = new Command(() => DumpDebugData());
            ExportAddonListCommand = new Command((parameter) => ExportAddonList(parameter));
            ImportAddonListCommand = new Command((parameter) => ImportAddonList(parameter));

            RetailAddonChannelChangeCommand = new Command(() =>
                OnAddonChannelChange(WowClientType.Retail, SelectedRetailAddonChannelType));
            RetailPtrAddonChannelChangeCommand = new Command(() =>
                OnAddonChannelChange(WowClientType.RetailPtr, SelectedRetailPtrAddonChannelType));
            ClassicAddonChannelChangeCommand = new Command(() =>
                OnAddonChannelChange(WowClientType.Classic, SelectedClassicAddonChannelType));
            ClassicPtrAddonChannelChangeCommand = new Command(() =>
                OnAddonChannelChange(WowClientType.ClassicPtr, SelectedClassicPtrAddonChannelType));
            BetaAddonChannelChangeCommand =
                new Command(() => OnAddonChannelChange(WowClientType.Beta, SelectedBetaAddonChannelType));

            RetailAutoUpdateChangeCommand =
                new Command(() => OnAddonAutoUpdateChange(WowClientType.Retail, RetailAutoUpdateAddons));
            RetailPtrAutoUpdateChangeCommand = new Command(() =>
                OnAddonAutoUpdateChange(WowClientType.RetailPtr, RetailPtrAutoUpdateAddons));
            ClassicAutoUpdateChangeCommand =
                new Command(() => OnAddonAutoUpdateChange(WowClientType.Classic, ClassicAutoUpdateAddons));
            ClassicPtrAutoUpdateChangeCommand = new Command(() =>
                OnAddonAutoUpdateChange(WowClientType.ClassicPtr, ClassicPtrAutoUpdateAddons));
            BetaAutoUpdateChangeCommand =
                new Command(() => OnAddonAutoUpdateChange(WowClientType.Beta, BetaAutoUpdateAddons));

            AddonChannelNames = new ObservableCollection<AddonChannelType>
            {
                AddonChannelType.Stable,
                AddonChannelType.Beta,
                AddonChannelType.Alpha
            };

            WowUpChannelNames = new ObservableCollection<WowUpReleaseChannelType>
            {
                WowUpReleaseChannelType.Stable,
                WowUpReleaseChannelType.Beta
            };

            LoadOptions();
        }


        private void LoadOptions()
        {
            IsTelemetryEnabled = _analyticsService.IsTelemetryEnabled();
            CollapseToTrayEnabled = _wowUpService.GetCollapseToTray();
            SelectedWowUpReleaseChannelType = _wowUpService.GetWowUpReleaseChannel();

            SelectedRetailAddonChannelType = _wowUpService.GetClientAddonChannelType(WowClientType.Retail);
            SelectedRetailPtrAddonChannelType = _wowUpService.GetClientAddonChannelType(WowClientType.RetailPtr);
            SelectedClassicAddonChannelType = _wowUpService.GetClientAddonChannelType(WowClientType.Classic);
            SelectedClassicPtrAddonChannelType = _wowUpService.GetClientAddonChannelType(WowClientType.ClassicPtr);
            SelectedBetaAddonChannelType = _wowUpService.GetClientAddonChannelType(WowClientType.Beta);

            RetailAutoUpdateAddons = _wowUpService.GetClientDefaultAutoUpdate(WowClientType.Retail);
            RetailPtrAutoUpdateAddons = _wowUpService.GetClientDefaultAutoUpdate(WowClientType.RetailPtr);
            ClassicAutoUpdateAddons = _wowUpService.GetClientDefaultAutoUpdate(WowClientType.Classic);
            ClassicPtrAutoUpdateAddons = _wowUpService.GetClientDefaultAutoUpdate(WowClientType.ClassicPtr);
            BetaAutoUpdateAddons = _wowUpService.GetClientDefaultAutoUpdate(WowClientType.Beta);

            WowRetailLocation = _warcraftService.GetClientLocation(WowClientType.Retail);
            WowRetailPtrLocation = _warcraftService.GetClientLocation(WowClientType.RetailPtr);
            WowClassicLocation = _warcraftService.GetClientLocation(WowClientType.Classic);
            WowClassicPtrLocation = _warcraftService.GetClientLocation(WowClientType.ClassicPtr);
            WowBetaLocation = _warcraftService.GetClientLocation(WowClientType.Beta);
        }

        private void ShowLogsFolder()
        {
            _wowUpService.ShowLogsFolder();
        }

        private void OnTelemetryChange()
        {
            _analyticsService.SetTelemetryEnabled(IsTelemetryEnabled);
        }

        private void OnCollapseToTrayChanged()
        {
            _wowUpService.SetCollapseToTray(CollapseToTrayEnabled);
        }

        /// <summary>
        /// Handle when the user wants to change the install folder for a particular client
        /// </summary>
        /// <param name="clientType"></param>
        private void OnSetLocation(WowClientType clientType)
        {
            var selectedPath = DialogUtilities.SelectFolder();
            if (string.IsNullOrEmpty(selectedPath))
            {
                return;
            }

            if (!_warcraftService.SetWowFolderPath(clientType, selectedPath))
            {
                System.Windows.MessageBox.Show($"Unable to set \"{selectedPath}\" as your {clientType} folder");
                return;
            }

            LoadOptions();
        }

        private void OnRescanFolders()
        {
            _warcraftService.ScanProducts();
            LoadOptions();
        }

        private void OnAddonChannelChange(WowClientType clientType, AddonChannelType addonChannelType)
        {
            _wowUpService.SetClientAddonChannelType(clientType, addonChannelType);
        }

        private void OnAddonAutoUpdateChange(WowClientType clientType, bool autoUpdate)
        {
            _wowUpService.SetClientDefaultAutoUpdate(clientType, autoUpdate);
        }

        private void OnWowUpReleaseChannelChange(WowUpReleaseChannelType type)
        {
            _wowUpService.SetWowUpReleaseChannel(type);
        }

        private async void DumpDebugData()
        {
            IsBusy = true;

            var curseAddonProvider = _serviceProvider.GetService<ICurseAddonProvider>();

            var clientTypes = _warcraftService.GetWowClientTypes();
            foreach (var clientType in clientTypes)
            {
                var addonFolders = await _warcraftService.ListAddons(clientType);
                var scanResults = await curseAddonProvider.GetScanResults(addonFolders);

                Log.Debug($"{clientType} ADDON CURSE FINGERPRINTS");
                foreach (var scanResult in scanResults)
                {
                    Log.Debug($"{scanResult.AddonFolder.Name}|{scanResult.FolderScanner.Fingerprint}");
                }
            }

            IsBusy = false;
        }

        private async void ExportAddonList(object parameter)
        {

            if (!(parameter is WowClientType))
                return;

            IsBusy = true;

            var clientType = (WowClientType)parameter;

            var addons = await _addonService.GetAddons(clientType);
            var sb = new StringBuilder();

            foreach (var addon in addons)
            {
                sb.AppendLine(addon.ExternalUrl + ";" + addon.Name.Replace(";", ""));
            }

            SaveFileDialog saveFileDialog = new SaveFileDialog();
            if (saveFileDialog.ShowDialog() == true)
                File.WriteAllText(Path.ChangeExtension(saveFileDialog.FileName, ".txt"), sb.ToString());

            IsBusy = false;
        }


        private async void ImportAddonList(object parameter)
        {
            if (!(parameter is WowClientType))
                return;

            IsBusy = true;

            var clientType = (WowClientType)parameter;

            var openFileDialog = new OpenFileDialog();
            List<string> AddonList = new List<string>();

            if (openFileDialog.ShowDialog() == true)
                AddonList = File.ReadAllLines(openFileDialog.FileName).ToList();

            // Instantiate the dialog box
            var dlg = _serviceProvider.GetService<ImportInProgressView>();
            var progressView = (dlg.DataContext as ImportInProgressViewModel);

            if (progressView == null)
                return;

            // Configure the dialog box
            dlg.Owner = Application.Current.MainWindow;
            progressView.EnableCloseButton = false;

            dlg.Show();

            var alreadyInstalled = 0;
            var addonNotFound = 0;
            var invalidUrls = 0;
            var others = 0;
            var NotSupported = 0;
            foreach (var addon in AddonList)
            {

                string addonName = addon.Split(";")[1];
                string addonUrl = addon.Split(";")[0];

                progressView.ProgressText += $"Importing \"{addonName}\" using \"{addonUrl}\"" + Environment.NewLine;
                PotentialAddon potentialAddon = null;

                try
                {
                    potentialAddon = await ImportUrl(addonUrl, addonName, clientType, progressView);
                }
                catch (AddonNotFoundException)
                {
                    addonNotFound++;
                    progressView.ProgressText += $"Addon \"{addonName}\" could not be found" + Environment.NewLine;
                }
                catch (AddonAlreadyInstalledException)
                {
                    alreadyInstalled++;
                    progressView.ProgressText += $"Addon \"{addonName}\" is already installed" + Environment.NewLine;
                }
                catch (InvalidUrlException)
                {
                    invalidUrls++;
                    progressView.ProgressText += $"Invalid Url: \"{addonUrl}\"" + Environment.NewLine;
                }
                catch (RateLimitExceededException)
                {
                    others++;
                    progressView.ProgressText +=
                        $"Rate limit exceeded, please wait a while and try again." + Environment.NewLine;
                }
                catch (Exception ex)
                {
                    if (addonUrl.Contains("tukui.com"))
                    {
                        NotSupported++;
                        progressView.ProgressText += $"Import of a TukUi addon is not yet supported: \"{addonName}\"" + Environment.NewLine;

                    }
                    else
                    {
                        others++;
                        progressView.ProgressText += $"Failed to install \"{addonName}\"" + Environment.NewLine;
                    }

                    Log.Error(ex, "Failed to install addon");
                }

                if (potentialAddon == null)
                {
                    continue;
                }

                await _addonService.InstallAddon(potentialAddon, clientType);
                progressView.ProgressText += $"Import of \"{addonName}\" was successful" + Environment.NewLine;
            }

            progressView.ProgressText += $"Import finished" + Environment.NewLine;

            progressView.ProgressText += $"Result: Tried to import {AddonList.Count} Addons" + Environment.NewLine;

            if (alreadyInstalled > 0)
                progressView.ProgressText += $"Result: {alreadyInstalled} Addons are already installed" + Environment.NewLine;
            if (addonNotFound > 0)
                progressView.ProgressText += $"Result: {addonNotFound} Addons could not be found" + Environment.NewLine;
            if (invalidUrls > 0)
                progressView.ProgressText += $"Result: {invalidUrls} Invalid Urls" + Environment.NewLine;
            if (others > 0)
                progressView.ProgressText += $"Result: {others} Other error" + Environment.NewLine;
            if (NotSupported > 0)
                progressView.ProgressText += $"Result: {NotSupported} Addons are not supported" + Environment.NewLine;

            progressView.ProgressText += $"Result: {AddonList.Count - alreadyInstalled - addonNotFound - invalidUrls - others - NotSupported} Addons successfully installed" + Environment.NewLine;



            progressView.EnableCloseButton = true;

            IsBusy = false;
        }


        private async Task<PotentialAddon> ImportUrl(string addonUrl, string addonName, WowClientType clientType, ImportInProgressViewModel progressView)
        {
            if (string.IsNullOrEmpty(addonUrl))
            {
                return null;
            }

            Uri uri = new Uri(addonUrl);

            //await _analyticsService.TrackUserAction("Addons", "ImportAddonUrl", $"{clientType}|{addonUrl}");

            var ImportedAddon = await _addonService.GetAddonByUri(uri, clientType);

            if (ImportedAddon == null)
            {
                throw new AddonNotFoundException();
            }

            if (_addonService.IsInstalled(ImportedAddon.ExternalId, clientType))
                throw new AddonAlreadyInstalledException();

            return ImportedAddon;


        }

    }
}
