using Serilog;
using System;
using System.Threading.Tasks;
using System.Windows;
using WowUp.Common.Enums;
using WowUp.Common.Exceptions;
using WowUp.Common.Extensions;
using WowUp.Common.Models;
using WowUp.WPF.Services.Contracts;
using WowUp.WPF.Utilities;

namespace WowUp.WPF.ViewModels
{
    public class InstallUrlDialogViewModel : BaseViewModel
    {
        private readonly IAddonService _addonService;
        private readonly IAnalyticsService _analyticsService;

        private Window _window;
        public Window Window
        {
            get => _window;
            set { SetProperty(ref _window, value); }
        }

        public WowClientType ClientType { get; set; }

        private string _title;
        public string Title
        {
            get => _title;
            set { SetProperty(ref _title, value); }
        }

        private string _input;
        public string Input
        {
            get => _input;
            set { SetProperty(ref _input, value); }
        }

        private PotentialAddon _importedAddon;
        public PotentialAddon ImportedAddon
        {
            get => _importedAddon;
            set { SetProperty(ref _importedAddon, value); }
        }

        private string _importedAddonSubtitle;
        public string ImportedAddonSubtitle
        {
            get => _importedAddonSubtitle;
            set { SetProperty(ref _importedAddonSubtitle, value); }
        }

        private bool _enableImportButton;
        public bool EnableImportButton
        {
            get => _enableImportButton;
            set { SetProperty(ref _enableImportButton, value); }
        }

        private bool _showImportedAddon;
        public bool ShowImportedAddon
        {
            get => _showImportedAddon;
            set { SetProperty(ref _showImportedAddon, value); }
        }

        private bool _enableInstall;
        public bool EnableInstall
        {
            get => _enableInstall;
            set { SetProperty(ref _enableInstall, value); }
        }

        private bool _canInstall;
        public bool CanInstall
        {
            get => _canInstall;
            set { SetProperty(ref _canInstall, value); }
        }

        private bool _isInstalled;
        public bool IsInstalled
        {
            get => _isInstalled;
            set { SetProperty(ref _isInstalled, value); }
        }

        private bool _isInstalling;
        public bool IsInstalling
        {
            get => _isInstalling;
            set { SetProperty(ref _isInstalling, value); }
        }

        public Command SubmitCommand { get; set; }
        public Command InstallCommand { get; set; }

        public InstallUrlDialogViewModel(
            IAddonService addonService,
            IAnalyticsService analyticsService)
        {
            _addonService = addonService;
            _analyticsService = analyticsService;

            Title = "Install Addon URL";
            EnableImportButton = true;

            SubmitCommand = new Command(() => OnSubmit());
            InstallCommand = new Command(() => OnInstall());
        }

        private async void OnSubmit()
        {
            IsBusy = true;
            EnableImportButton = false;
            ShowImportedAddon = false;

            try
            {
                await ImportUrl(Input);
                EnableInstall = true;
            }
            catch (Exception)
            {
                // eat
            }
            finally
            {
                IsBusy = false;
                EnableImportButton = true;
            }

            //Window.DialogResult = true;
        }

        private async void OnInstall()
        {
            if (ImportedAddon == null)
            {
                return;
            }

            EnableInstall = false;
            CanInstall = false;
            IsInstalled = false;
            IsInstalling = true;

            try
            {
                await _analyticsService.TrackUserAction("Addons", "InstallByUrlImport", $"{ClientType}|{ImportedAddon.Name}");

                await _addonService.InstallAddon(ImportedAddon, ClientType);

                IsInstalled = true;
            }
            catch (Exception)
            {
                EnableInstall = true;
                CanInstall = true;
                MessageBox.Show("Failed to install addon");
            }
            finally
            {
                IsInstalling = false;
            }
        }

        private Uri GetInputUri(string input)
        {
            try
            {
                return new Uri(input);
            }
            catch (Exception)
            {
                Input = string.Empty;
                MessageBox.Show("Input was not a valid URL.");
                throw;
            }
        }

        private async Task ImportUrl(string input)
        {
            if (string.IsNullOrEmpty(input))
            {
                return;
            }

            Uri uri = GetInputUri(input);

            try
            {
                await _analyticsService.TrackUserAction("Addons", "ImportAddonUrl", $"{ClientType}|{input}");
                
                ImportedAddon = await _addonService.GetAddonByUri(uri, ClientType);

                if (ImportedAddon == null)
                {
                    throw new AddonNotFoundException();
                }

                ImportedAddonSubtitle = $"By {ImportedAddon.Author}\n{ImportedAddon.DownloadCount.FormatDownloadCount()} downloads on {ImportedAddon.ProviderName}";
                IsInstalled = _addonService.IsInstalled(ImportedAddon.ExternalId, ClientType);
                CanInstall = !IsInstalled;
                ShowImportedAddon = true;
            }
            catch (AddonNotFoundException)
            {
                MessageBox.Show("Addon not found");
            }
            catch (AddonAlreadyInstalledException)
            {
                MessageBox.Show("Addon already installed");
            }
            catch (InvalidUrlException)
            {
                MessageBox.Show("Invalid URL detected");
            }
            catch (RateLimitExceededException)
            {
                MessageBox.Show("Rate limit exceeded, please wait a while and try again.");
            }
            catch (Exception ex)
            {
                Log.Error(ex, "Failed to install addon");
                MessageBox.Show("Failed to import addon");
            }
        }
    }
}
