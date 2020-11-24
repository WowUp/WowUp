using Serilog;
using System;
using WowUp.Common.Enums;
using WowUp.Common.Services.Contracts;
using WowUp.WPF.Extensions;
using WowUp.WPF.Services.Contracts;
using WowUp.WPF.Utilities;

namespace WowUp.WPF.ViewModels
{
    public class ApplicationUpdateControlViewModel : BaseViewModel
    {
        private readonly ISessionService _sessionService;
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

        private bool _showUpdaterMissing;
        public bool ShowUpdaterMissing
        {
            get => _showUpdaterMissing;
            set { SetProperty(ref _showUpdaterMissing, value); }
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

        private string _latestVersion;
        public string LatestVersion
        {
            get => _latestVersion;
            set { SetProperty(ref _latestVersion, value); }
        }

        public decimal _progressPercent;
        public decimal ProgressPercent
        {
            get => _progressPercent;
            set { SetProperty(ref _progressPercent, value); }
        }

        private bool _didUpdateError;
        private bool _isUpdatePending;
        private bool _updaterReady;

        public Command DownloadUpdateCommand { get; set; }
        public Command RestartAppCommand { get; set; }

        public ApplicationUpdateControlViewModel(
            ISessionService sessionService,
            IWowUpService wowUpService)
        {
            _sessionService = sessionService;
            _wowUpService = wowUpService;

            _wowUpService.PreferenceUpdated += WowUpService_PreferenceUpdated;

            _sessionService.SessionChanged += SessionService_SessionChanged;

            DownloadUpdateCommand = new Command(() => OnDownloadUpdate());
            RestartAppCommand = new Command(() => OnRestartApp());

            ProgressText = string.Empty;

            _timer = new System.Threading.Timer(CheckVersion, null, TimeSpan.Zero, TimeSpan.FromMinutes(10));
        }

        private void SessionService_SessionChanged(object sender, Common.Models.Events.SessionEventArgs e)
        {
            _updaterReady = e.SessionState.UpdaterReady;
            CheckVersion(null);
        }

        private void WowUpService_PreferenceUpdated(object sender, Models.WowUp.WowUpPreferenceEventArgs e)
        {
            if (e.Preference.Key == Constants.Preferences.WowUpReleaseChannelKey)
            {
                CheckVersion(null);
            }
        }

        private async void CheckVersion(object state)
        {
            ShowDownload = true;
            IsUpdateAvailable = true;

            //if (_didUpdateError || _isUpdatePending || !_updaterReady)
            //{
            //    return;
            //}

            //try
            //{
            //    var latestVersion = await _wowUpService.GetLatestClientVersion();

            //    LatestVersion = latestVersion.Version;
            //    ShowDownload = IsUpdateAvailable = await _wowUpService.IsUpdateAvailable();
            //}
            //catch (Exception ex)
            //{
            //    Log.Error(ex, "Failure during WowUp version check");
            //    ShowDownload = IsUpdateAvailable = false;
            //}
        }

        private void OnRestartApp()
        {
            _wowUpService.InstallUpdate();
        }

        private async void OnDownloadUpdate()
        {
            new Uri("https://wowup.io").AbsoluteUri.OpenUrlInBrowser();

            //ShowDownload = false;
            //ShowProgress = true;
            //_isUpdatePending = true;

            //try
            //{
            //    OnDownloadState(ApplicationUpdateState.Downloading);
            //    await _wowUpService.DownloadUpdate(progress =>
            //    {
            //        ProgressPercent = progress;
            //    });

            //    ShowRestart = true;
            //}
            //catch (Exception)
            //{
            //    _didUpdateError = true;
            //    _isUpdatePending = false;
            //}
            //finally
            //{
            //    OnDownloadState(ApplicationUpdateState.Complete);
            //}

            //ShowProgress = false;
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
