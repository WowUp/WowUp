using Hardcodet.Wpf.TaskbarNotification;
using Serilog;
using System;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using WowUp.Common.Enums;
using WowUp.Common.Models;
using WowUp.Common.Models.Events;
using WowUp.WPF.Services.Contracts;

namespace WowUp.WPF.Services
{
    public class SessionService : ISessionService
    {
        private readonly SessionState _sessionState;
        private readonly IAddonService _addonService;
        private readonly IWowUpService _wowUpService;

        private Timer _updateCheckTimer;
        private Timer _autoUpdateCheckTimer;

        public event SessionTextEventHandler ContextTextChanged;
        public event SessionEventHandler SessionChanged;
        public event SessionTabEventHandler TabChanged;

        public TaskbarIcon TaskbarIcon { get; set; }

        public SessionService(
            IAddonService addonService,
            IWarcraftService warcraftService,
            IWowUpService wowUpService)
        {
            _addonService = addonService;
            _wowUpService = wowUpService;

            var installedClientTypes = warcraftService.GetWowClientTypes();
            var lastSelectedType = _wowUpService.GetLastSelectedClientType(); 
            var initialClientType = installedClientTypes.Any() ? installedClientTypes.First() : WowClientType.None;

            // If the user has no stored type, or the type is no longer found just set it.
            if(lastSelectedType == WowClientType.None || !installedClientTypes.Any(ct => ct == lastSelectedType))
            {
                _wowUpService.SetLastSelectedClientType(initialClientType);
            }
            else
            {
                initialClientType = lastSelectedType;
            }

            _sessionState = new SessionState
            {
                SelectedClientType = initialClientType,
                StatusText = string.Empty,
                UpdaterReady = false
            };

        }

        private async void UpdateCheckTimerElapsed()
        {
            await CheckUpdaterApp();
        }

        public WowClientType SelectedClientType
        {
            get { return _sessionState.SelectedClientType; }
            set
            {
                _wowUpService.SetLastSelectedClientType(value);
                _sessionState.SelectedClientType = value;
                SendStateChange();
            }
        }

        private Type _selectedTabType;
        public Type SelectedTabType
        {
            get { return _selectedTabType; }
            set
            {
                _selectedTabType = value;
                SetContextText(string.Empty);
                TabChanged?.Invoke(this, value);
            }
        }

        public string StatusText
        {
            get { return _sessionState.StatusText; }
            set
            {
                _sessionState.StatusText = value;
                SendStateChange();
            }
        }

        public string ContextText { get; private set; }

        public bool UpdaterReady
        {
            get { return _sessionState.UpdaterReady; }
            set
            {
                _sessionState.UpdaterReady = value;
                SendStateChange();
            }
        }

        private void SendStateChange()
        {
            SessionChanged?.Invoke(this, new SessionEventArgs(_sessionState));
        }

        public void AppLoaded()
        {
            if(_updateCheckTimer == null)
            {
                _updateCheckTimer = new Timer(_ => UpdateCheckTimerElapsed(), null, TimeSpan.FromSeconds(0), TimeSpan.FromMinutes(60));
            }

            if (_autoUpdateCheckTimer == null)
            {
                _autoUpdateCheckTimer = new Timer(_ => ProcessAutoUpdates(), null, TimeSpan.FromSeconds(0), TimeSpan.FromMinutes(60));
            }
        }

        public void SetContextText(object requestor, string text)
        {
            if(requestor.GetType() != SelectedTabType)
            {
                // If the request is not from the active tab, dont set it
                return;
            }

            SetContextText(text);
        }

        private async void ProcessAutoUpdates()
        {
            var updateCount = await _addonService.ProcessAutoUpdates();

            if (TaskbarIcon != null && updateCount > 0)
            {
                TaskbarIcon.ShowBalloonTip("WowUp", $"Automatically updated {updateCount} addons.", TaskbarIcon.Icon, true);
            }
        }

        private void SetContextText(string text)
        {
            ContextText = text;
            ContextTextChanged?.Invoke(this, ContextText);
        }

        private async Task CheckUpdaterApp()
        {
            try
            {
                StatusText = "Checking updater app...";
                await _wowUpService.CheckUpdaterApp((progress) =>
                {
                    StatusText = $"Downloading updater ({progress}%)...";
                });

                UpdaterReady = true;
                StatusText = string.Empty;
            }
            catch (Exception ex)
            {
                Log.Error(ex, "Failed during updater check");
                StatusText = "Updater check error";
            }
        }
    }
}
