using Serilog;
using System;
using System.Threading.Tasks;
using System.Windows;
using WowUp.Common.Enums;
using WowUp.WPF.Entities;
using WowUp.WPF.Extensions;
using WowUp.WPF.Services.Contracts;
using WowUp.WPF.Utilities;

namespace WowUp.WPF.ViewModels
{
    public class AddonListItemViewModel : BaseViewModel
    {
        private readonly IAddonService _addonService;

        private Addon _addon;
        public Addon Addon {
            get => _addon;
            set
            {
                _addon = value;
                SetupDisplayState();
            }
        }

        public Command ActionCommand { get; set; }
        public Command InstallCommand { get; set; }
        public Command OpenLinkCommand { get; set; }
        public Command ReInstallCommand { get; set; }
        public Command UninstallCommand { get; set; }
        public Command IgnoreCheckedCommand { get; set; }

        private bool _showInstallButton;
        public bool ShowInstallButton
        {
            get => _showInstallButton;
            set { SetProperty(ref _showInstallButton, value); }
        }

        private bool _showUpdateButton;
        public bool ShowUpdateButton
        {
            get => _showUpdateButton;
            set { SetProperty(ref _showUpdateButton, value); }
        }

        private bool _showProgressBar;
        public bool ShowProgressBar
        {
            get => _showProgressBar;
            set { SetProperty(ref _showProgressBar, value); }
        }

        public bool _showStatusText;
        public bool ShowStatusText
        {
            get => _showStatusText;
            set { SetProperty(ref _showStatusText, value); }
        }

        public bool _showUninstall;
        public bool ShowUninstall
        {
            get => _showUninstall;
            set { SetProperty(ref _showUninstall, value); }
        }

        public bool _showReInstall;
        public bool ShowReInstall
        {
            get => _showReInstall;
            set { SetProperty(ref _showReInstall, value); }
        }

        private string _progressText;
        public string ProgressText
        {
            get => _progressText;
            set { SetProperty(ref _progressText, value); }
        }

        private decimal _progressPercent;
        public decimal ProgressPercent
        {
            get => _progressPercent;
            set { SetProperty(ref _progressPercent, value); }
        }

        private string _name;
        public string Name
        {
            get => _name;
            set { SetProperty(ref _name, value); }
        }

        private string _currentVersion;
        public string CurrentVersion
        {
            get => _currentVersion;
            set { SetProperty(ref _currentVersion, value); }
        }

        private string _latestVersion;
        public string LatestVersion
        {
            get => _latestVersion;
            set { SetProperty(ref _latestVersion, value); }
        }

        private string _author;
        public string Author
        {
            get => _author;
            set { SetProperty(ref _author, value); }
        }

        private string _gameVersion;
        public string GameVersion
        {
            get => _gameVersion;
            set { SetProperty(ref _gameVersion, value); }
        }

        private string _thumbnailUrl;
        public string ThumbnailUrl
        {
            get => _thumbnailUrl;
            set { SetProperty(ref _thumbnailUrl, value); }
        }

        private string _externalUrl;
        public string ExternalUrl
        {
            get => _externalUrl;
            set { SetProperty(ref _externalUrl, value); }
        }

        private AddonDisplayState _displayState;
        public AddonDisplayState DisplayState
        {
            get => _displayState;
            set { SetProperty(ref _displayState, value); }
        }

        private bool _isIgnored;
        public bool IsIgnored
        {
            get => _isIgnored;
            set { 
                SetProperty(ref _isIgnored, value); 
            }
        }

        private string _statusText;
        public string StatusText
        {
            get => _statusText;
            set { SetProperty(ref _statusText, value); }
        }

        public bool CanInstall => _addon.CanInstall();
        public bool CanUpdate => _addon.CanUpdate();

        public AddonListItemViewModel(
            IAddonService addonService) 
            : base()
        {
            _addonService = addonService;

            InstallCommand = new Command(async () => await InstallAddon());
            OpenLinkCommand = new Command(() => ExternalUrl.OpenUrlInBrowser());
            ReInstallCommand = new Command(() => OnReInstall());
            UninstallCommand = new Command(() => OnUninstall());
            IgnoreCheckedCommand = new Command(() => OnIgnoreChanged());
        }

        private void SetupDisplayState()
        {
            Name = _addon.Name;
            CurrentVersion = string.IsNullOrEmpty(_addon.InstalledVersion)
                ? "None"
                : _addon.InstalledVersion;
            LatestVersion = _addon.LatestVersion;
            Author = _addon.Author;
            GameVersion = _addon.GameVersion;
            ThumbnailUrl = string.IsNullOrEmpty(_addon.ThumbnailUrl)
                ? "/Assets/wowup_logo_1.png"
                : _addon.ThumbnailUrl;

            IsIgnored = _addon.IsIgnored;
            ExternalUrl = _addon.ExternalUrl;
            DisplayState = _addon.GetDisplayState();
            ShowInstallButton = DisplayState == AddonDisplayState.Install;
            ShowUpdateButton = DisplayState == AddonDisplayState.Update;
            ShowStatusText = DisplayState == AddonDisplayState.UpToDate || DisplayState == AddonDisplayState.Ignored;
            ShowReInstall = DisplayState == AddonDisplayState.UpToDate;
            ShowUninstall = DisplayState != AddonDisplayState.Unknown;
            ShowProgressBar = false;
            StatusText = GetStatusText(DisplayState);
        }

        public async Task InstallAddon()
        {
            ShowStatusText = false;
            ShowInstallButton = false;

            try
            {
                await _addonService.InstallAddon(_addon.Id, OnInstallUpdate);
            }
            catch (Exception ex)
            {
                Console.WriteLine(ex);
                ShowInstallButton = true;
            }

            //var result = await Application.Current.MainPage.DisplayActionSheet("Test", "Cancel", "Delete", "Recheck");
        }

        private async void OnReInstall()
        {
            await InstallAddon();
        }

        private async void OnUninstall()
        {
            try
            {
                await _addonService.UninstallAddon(Addon);
            }
            catch (Exception ex)
            {
                Log.Error(ex, $"Failed to uninstall addon {Addon.Name}");
                MessageBox.Show("An error occurred during uninstall.");
            }
        }

        private void OnIgnoreChanged()
        {
            _addon.IsIgnored = !_addon.IsIgnored;

            _addonService.UpdateAddon(_addon);

            SetupDisplayState();
        }

        private void OnInstallUpdate(AddonInstallState installState, decimal percent)
        {
            ProgressText = GetInstallStateText(installState);
            ProgressPercent = percent;
            ShowProgressBar = true;

            if (installState == AddonInstallState.Complete)
            {
                _addon = _addonService.GetAddon(_addon.Id);
                SetupDisplayState();
            }
        }

        private string GetStatusText(AddonDisplayState displayState)
        {
            switch (displayState)
            {
                case AddonDisplayState.UpToDate:
                    return "Up to Date";
                case AddonDisplayState.Ignored:
                    return "Ignored";
                case AddonDisplayState.Update:
                case AddonDisplayState.Install:
                case AddonDisplayState.Unknown:
                default:
                    return string.Empty;
            }
        }

        private string GetInstallStateText(AddonInstallState installState)
        {
            switch (installState)
            {
                case AddonInstallState.Pending:
                    return "Pending";
                case AddonInstallState.Downloading:
                    return "Downloading";
                case AddonInstallState.BackingUp:
                    return "BackingUp";
                case AddonInstallState.Installing:
                    return "Installing";
                case AddonInstallState.Complete:
                    return "Complete";
                default:
                    return "Unknown";
            }
        }
    }
}
