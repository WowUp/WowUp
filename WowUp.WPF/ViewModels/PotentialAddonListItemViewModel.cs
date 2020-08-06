using Serilog;
using System;
using WowUp.Common.Enums;
using WowUp.Common.Models;
using WowUp.WPF.Extensions;
using WowUp.WPF.Services.Contracts;
using WowUp.WPF.Utilities;

namespace WowUp.WPF.ViewModels
{
    public class PotentialAddonListItemViewModel : BaseViewModel
    {
        private readonly IAddonService _addonService;
        private readonly IAnalyticsService _analyticsService;

        public WowClientType ClientType { get; set; }

        private PotentialAddon _addon;
        public PotentialAddon Addon
        {
            get => _addon;
            set
            {
                _addon = value;
                SetupDisplayState();
            }
        }

        private string _name;
        public string Name
        {
            get => _name;
            set { SetProperty(ref _name, value); }
        }

        private string _providerName;
        public string ProviderName
        {
            get => _providerName;
            set { SetProperty(ref _providerName, value); }
        }

        private string _thumbnailUrl;
        public string ThumbnailUrl
        {
            get => _thumbnailUrl;
            set { SetProperty(ref _thumbnailUrl, value); }
        }

        private string _downloadCount;
        public string DownloadCount
        {
            get => _downloadCount;
            set { SetProperty(ref _downloadCount, value); }
        }

        private string _externalUrl;
        public string ExternalUrl
        {
            get => _externalUrl;
            set { SetProperty(ref _externalUrl, value); }
        }

        public string _author;
        public string Author
        {
            get => _author;
            set { SetProperty(ref _author, value); }
        }

        private bool _showInstallButton;
        public bool ShowInstallButton
        {
            get => _showInstallButton;
            set { SetProperty(ref _showInstallButton, value); }
        }

        private decimal _installProgress;
        public decimal InstallProgress
        {
            get => _installProgress;
            set { SetProperty(ref _installProgress, value); }
        }

        private bool _showProgressBar;
        public bool ShowProgressBar
        {
            get => _showProgressBar;
            set { SetProperty(ref _showProgressBar, value); }
        }

        private string _progressText;
        public string ProgressText
        {
            get => _progressText;
            set { SetProperty(ref _progressText, value); }
        }

        private bool _showProgressText;
        public bool ShowProgressText
        {
            get => _showProgressText;
            set { SetProperty(ref _showProgressText, value); }
        }

        private bool _isInstalled;
        public bool IsInstalled
        {
            get => _isInstalled;
            set { SetProperty(ref _isInstalled, value); }
        }

        public Command OpenLinkCommand { get; set; }
        public Command InstallCommand { get; set; }

        public PotentialAddonListItemViewModel(
            IAddonService addonService,
            IAnalyticsService analyticsService)
        {
            _addonService = addonService;
            _analyticsService = analyticsService;

            OpenLinkCommand = new Command(() => ExternalUrl.OpenUrlInBrowser());
            InstallCommand = new Command(() => OnInstall());
        }

        private async void OnInstall()
        {
            ShowInstallButton = false;

            try
            {
                await _addonService.InstallAddon(Addon, ClientType, OnInstallUpdate);

                await _analyticsService.TrackUserAction("Addons", "InstallFeaturedAddon", $"{ClientType}|{Addon.Name}");
            }
            catch (Exception ex)
            {
                Log.Error(ex, "Failed to install addon");
                ShowInstallButton = true;
            }
        }

        private void OnInstallUpdate(AddonInstallState installState, decimal percent)
        {
            ProgressText = GetInstallStateText(installState);
            InstallProgress = percent;
            ShowProgressBar = true;
            ShowProgressText = true;

            if (installState == AddonInstallState.Complete)
            {
                ShowInstallButton = false;
                ShowProgressBar = false;
            }
        }

        private string GetInstallStateText(AddonInstallState installState)
        {
            return installState switch
            {
                AddonInstallState.Pending => "Pending",
                AddonInstallState.Downloading => "Downloading",
                AddonInstallState.BackingUp => "BackingUp",
                AddonInstallState.Installing => "Installing",
                AddonInstallState.Complete => "Complete",
                _ => "Unknown",
            };
        }

        private void SetupDisplayState()
        {
            ShowInstallButton = !IsInstalled;
            Name = Addon.Name;
            ThumbnailUrl = Addon.ThumbnailUrl;
            DownloadCount = FormatDownloadCount(Addon.DownloadCount);
            ExternalUrl = Addon.ExternalUrl;
            Author = Addon.Author;
            ProviderName = Addon.ProviderName;
        }

        private string FormatDownloadCount(int downloadCount)
        {
            var suffix = string.Empty;
            var value = (double)downloadCount;
            if(downloadCount >= 1000000)
            {
                suffix = "million ";
                value /= 1000000.0;
            }
            else if(downloadCount >= 1000)
            {
                suffix = "thousand ";
                value /= 1000.0;
            }

            return string.Format("{0:0.0} {1}downloads", value, suffix);
        }
    }
}
