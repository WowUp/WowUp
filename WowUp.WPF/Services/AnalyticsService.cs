using Flurl;
using Flurl.Http;
using System;
using System.Threading.Tasks;
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

        public string InstallId { get; private set; }

        public AnalyticsService(
            IPreferenceRepository preferenceRepository)
        {
            _preferenceRepository = preferenceRepository;

            InstallId = GetInstallId();
        }

        public async Task Track()
        {
            if(!IsTelemetryEnabled())
            {
                return;
            }

            var url = $"{AnalyticsUrl}/collect";

            try
            {
                var response = await url
                    .WithHeaders(HttpUtilities.DefaultHeaders)
                    .SetQueryParam("v", "1")
                    .SetQueryParam("tid", "UA-92563227-4")
                    .SetQueryParam("cid", InstallId)
                    .SetQueryParam("t", "pageview")
                    .SetQueryParam("dp", "startup")
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
            if(telemetryPreference == null)
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

        public async Task TrackStartup()
        {
            await Track();
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
