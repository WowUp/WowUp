using System;
using System.Windows;
using WowUp.Common.Enums;
using WowUp.Common.Services.Contracts;
using WowUp.WPF.Utilities;

namespace WowUp.WPF.ViewModels
{
    public class ApplicationUpdateControlViewModel : BaseViewModel
    {
        private readonly IWowUpService _wowUpService;
        private readonly System.Threading.Timer _timer;

        private bool _isUpdateAvailable;
        public bool IsUpdateAvailable
        {
            get => _isUpdateAvailable;
            set { SetProperty(ref _isUpdateAvailable, value); }
        }

        private bool _progressIndeterminate;
        public bool ProgressIndeterminate
        {
            get => _progressIndeterminate;
            set { SetProperty(ref _progressIndeterminate, value); }
        }

        private bool _showProgress;
        public bool ShowProgress
        {
            get => _showProgress;
            set { SetProperty(ref _showProgress, value); }
        }

        private bool _showDownload;
        public bool ShowDownload
        {
            get => _showDownload;
            set { SetProperty(ref _showDownload, value); }
        }

        private bool _showRestart;
        public bool ShowRestart
        {
            get => _showRestart;
            set { SetProperty(ref _showRestart, value); }
        }

        private string _progressText;
        public string ProgressText
        {
            get => _progressText;
            set { SetProperty(ref _progressText, value); }
        }

        public decimal _progressPercent;
        public decimal ProgressPercent
        {
            get => _progressPercent;
            set { SetProperty(ref _progressPercent, value); }
        }

        private bool _didUpdateError;

        public Command DownloadUpdateCommand { get; set; }
        public Command RestartAppCommand { get; set; }

        public ApplicationUpdateControlViewModel(
            IWowUpService wowUpService)
        {
            _wowUpService = wowUpService;

            DownloadUpdateCommand = new Command(() => OnDownloadUpdate());
            RestartAppCommand = new Command(() => OnRestartApp());

            ProgressText = string.Empty;

            _timer = new System.Threading.Timer(CheckVersion, null, TimeSpan.Zero, TimeSpan.FromSeconds(10));
        }

        private async void CheckVersion(object state)
        {
            if (_didUpdateError)
            {
                return;
            }

            ShowDownload = IsUpdateAvailable = await _wowUpService.IsUpdateAvailable();
        }

        private void OnRestartApp()
        {
            Application.Current.MainWindow.Close();
            Application.Current.Shutdown();
            System.Diagnostics.Process.Start(FileUtilities.ExecutablePath);
        }

        private async void OnDownloadUpdate()
        {
            ShowDownload = false;
            ShowProgress = true;

            try
            {
                await _wowUpService.UpdateApplication((state, progress) =>
                {
                    OnDownloadState(state);
                    ProgressPercent = progress;
                });

                ShowRestart = true;
            }
            catch (Exception)
            {
                _didUpdateError = true;
            }

            ShowProgress = false;
        }

        private void OnDownloadState(ApplicationUpdateState state)
        {
            switch (state)
            {
                case ApplicationUpdateState.CreateBackup:
                    ProgressIndeterminate = false;
                    ProgressText = "Creating backup...";
                    break;
                case ApplicationUpdateState.Downloading:
                    ProgressIndeterminate = false;
                    ProgressText = "Downloading update...";
                    break;
                case ApplicationUpdateState.Unpacking:
                    ProgressIndeterminate = true;
                    ProgressText = "Unpacking...";
                    break;
                case ApplicationUpdateState.Complete:
                    ShowProgress = false;
                    break;
            }
        }
    }
}
