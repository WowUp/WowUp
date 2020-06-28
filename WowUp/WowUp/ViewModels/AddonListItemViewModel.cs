using System;
using System.Threading.Tasks;
using WowUp.Entities;
using WowUp.Models;
using WowUp.Services;
using Xamarin.Forms;

namespace WowUp.ViewModels
{
    public class AddonListItemViewModel : BaseViewModel
    {
        private readonly IAddonService _addonService = DependencyService.Get<IAddonService>();

        private Addon _addon;

        public Command ActionCommand { get; set; }
        public Command InstallCommand { get; set; }

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

        public bool _showUpToDate;
        public bool ShowUpToDate
        {
            get => _showUpToDate;
            set { SetProperty(ref _showUpToDate, value); }
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

        public AddonListItemViewModel(Addon addon): base()
        {
            _addon = addon;

            InstallCommand = new Command(async () => await OnInstall());

            SetupDisplayState();
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
            ThumbnailUrl = _addon.ThumbnailUrl;

            ShowInstallButton = string.IsNullOrEmpty(_addon.InstalledVersion);
            ShowUpToDate = !string.IsNullOrEmpty(_addon.InstalledVersion) && _addon.InstalledVersion == _addon.LatestVersion;
            ShowProgressBar = false;
        }

        async Task OnInstall()
        {
            ShowInstallButton = false;

            try
            {
                await _addonService.InstallAddon(_addon.Id, OnInstallUpdate);
            }
            catch(Exception ex)
            {
                Console.WriteLine(ex);
                ShowInstallButton = true;
            }

            //var result = await Application.Current.MainPage.DisplayActionSheet("Test", "Cancel", "Delete", "Recheck");
        }

        private void OnInstallUpdate(AddonInstallState installState, decimal percent)
        {
            ProgressText = GetInstallStateText(installState);
            ProgressPercent = percent;
            ShowProgressBar = true;

            if(installState == AddonInstallState.Complete)
            {
                _addon = _addonService.GetAddon(_addon.Id);
                SetupDisplayState();
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
