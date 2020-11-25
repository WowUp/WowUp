using Flurl;
using Flurl.Http;
using Microsoft.AppCenter;
using Microsoft.AppCenter.Analytics;
using Microsoft.AppCenter.Crashes;
using Serilog;
using System;
using System.Collections.Generic;
using System.Threading.Tasks;
using WowUp.Common.Services.Contracts;
using WowUp.WPF.Entities;
using WowUp.WPF.Repositories.Contracts;
using WowUp.WPF.Services.Contracts;
using WowUp.WPF.Utilities;

namespace WowUp.WPF.Services
{
    public class AnalyticsService : IAnalyticsService
    {
        private const string InstallIdPreferenceKey = "install_id";
        private const string TelemetryPromptUsedKey = "telemetry_prompt_sent";
        private const string TelemetryEnabledKey = "telemetry_enabled";
        private const string AnalyticsUrl = "https://www.google-analytics.com";

        private readonly IPreferenceRepository _preferenceRepository;
        private readonly IWowUpApiService _wowUpApiService;

        private bool _appCenterStarted = false;

        public string InstallId { get; private set; }

        public AnalyticsService(
            IPreferenceRepository preferenceRepository,
            IWowUpApiService wowUpApiService)
        {
            _preferenceRepository = preferenceRepository;
            _wowUpApiService = wowUpApiService;

            preferenceRepository.PreferenceUpdated += PreferenceRepository_PreferenceUpdated;

            InstallId = GetInstallId();
        }

        private async void PreferenceRepository_PreferenceUpdated(object sender, Models.Events.PreferenceEventArgs e)
        {
            if (e.Preference.Key != TelemetryEnabledKey)
            {
                return;
            }

            await SetAppCenterEnabled(e.Preference.Value == true.ToString());
        }

        public async Task TrackStartup()
        {
            await Track(request =>
            {
                request.SetQueryParam("t", "pageview")
                    .SetQueryParam("dp", "app/startup");
            });

            await TrackAppCenter("AppStartup");
        }

        public async Task TrackUserAction(string category, string action, string label = null)
        {
            await Track(request =>
            {
                request.SetQueryParam("t", "event")
                    .SetQueryParam("ec", category)
                    .SetQueryParam("ea", action)
                    .SetQueryParam("el", label);
            });

            await TrackAppCenter($"{category}|{action}", new Dictionary<string, string>
            {
                { "label", label ?? string.Empty }
            });
        }

        public async void Track(Exception ex, string message = "")
        {
            Log.Error(ex, message);
            await Track(ex, false, message);
        }

        public async Task Track(Exception ex, bool isFatal = false, string message = "")
        {
            await Track(request =>
            {
                request.SetQueryParam("t", "exception")
                    .SetQueryParam("exd", ex.GetType().Name)
                    .SetQueryParam("exf", isFatal ? "1" : "0");
            });

            await TrackAppCenter(ex, isFatal);
        }

        private async Task TrackAppCenter(string eventName, IDictionary<string, string> properties = null)
        {
            if (!IsTelemetryEnabled())
            {
                await SetAppCenterEnabled(false);
                return;
            }

            await StartAppCenter();

            Analytics.TrackEvent(eventName, properties);
        }

        private async Task TrackAppCenter(Exception ex, bool isFatal)
        {
            if (!IsTelemetryEnabled())
            {
                await SetAppCenterEnabled(false);
                return;
            }

            await StartAppCenter();

            Crashes.TrackError(ex, new Dictionary<string, string>
            {
                { "isFatal", isFatal.ToString() }
            });
        }

        private async Task SetAppCenterEnabled(bool enabled)
        {
            await Analytics.SetEnabledAsync(enabled);
            await Crashes.SetEnabledAsync(enabled);
        }

        private async Task StartAppCenter()
        {
            if (_appCenterStarted)
            {
                return;
            }

            try
            {
                var appCenter = await _wowUpApiService.GetAppCenter();
                if (string.IsNullOrEmpty(appCenter?.AppId))
                {
                    throw new Exception("Failed to setup appcenter");
                }

                AppCenter.Start(appCenter.AppId, typeof(Analytics), typeof(Crashes));

                await SetAppCenterEnabled(true);
            }
            catch(Exception)
            {
                // eat
            }
            finally
            {
                _appCenterStarted = true;
            }
        }

        private async Task Track(Action<IFlurlRequest> requestAction)
        {
            if (!IsTelemetryEnabled())
            {
                return;
            }

            var url = $"{AnalyticsUrl}/collect";

            try
            {
                var request = url
                    .WithHeaders(HttpUtilities.DefaultHeaders);

                requestAction?.Invoke(request);

                var response = await request
                    .SetQueryParam("v", "1")
                    .SetQueryParam("tid", "UA-92563227-4")
                    .SetQueryParam("cid", InstallId)
                    .SetQueryParam("ua", HttpUtilities.UserAgent)
                    .SetQueryParam("an", "WowUp Client")
                    .SetQueryParam("av", AppUtilities.CurrentVersionString)
                    .PostJsonAsync(new { });
            }
            catch (Exception)
            {
                // eat
            }
        }

        public void SetTelemetryEnabled(bool enabled)
        {
            var telemetryPreference = _preferenceRepository.FindByKey(TelemetryEnabledKey);
            if (telemetryPreference == null)
            {
                telemetryPreference = new Preference
                {
                    Key = TelemetryEnabledKey,
                    Value = enabled.ToString()
                };
            }
            else
            {
                telemetryPreference.Value = enabled.ToString();
            }

            _preferenceRepository.SaveItem(telemetryPreference);
        }

        public bool IsTelemetryEnabled()
        {
            var telemetryPreference = _preferenceRepository.FindByKey(TelemetryEnabledKey);
            return telemetryPreference?.Value == true.ToString();
        }

        public void PromptTelemetry()
        {
            var telemetryPrompted = _preferenceRepository.FindByKey(TelemetryPromptUsedKey);
            if (telemetryPrompted != null)
            {
                return;
            }

            var result = System.Windows.MessageBox.Show("Help me improve WowUp by sending anonymous app install data and/or errors?", "WowUp Telemetry", System.Windows.MessageBoxButton.YesNo);

            SetTelemetryEnabled(result == System.Windows.MessageBoxResult.Yes);

            var telemetryPromptPreference = new Preference
            {
                Key = TelemetryPromptUsedKey,
                Value = true.ToString()
            };

            _preferenceRepository.SaveItem(telemetryPromptPreference);
        }

        private string GetInstallId()
        {
            var preference = _preferenceRepository.FindByKey(InstallIdPreferenceKey);
            if (preference != null)
            {
                return preference.Value;
            }

            preference = new Preference
            {
                Key = InstallIdPreferenceKey,
                Value = Guid.NewGuid().ToString()
            };

            _preferenceRepository.AddItem(preference);

            return preference.Value;
        }
    }
}
