using Flurl;
using Flurl.Http;
using System;
using System.Collections.Generic;
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
        private const string AnalyticsUrl = "https://www.google-analytics.com";

        private readonly IPreferenceRepository _preferenceRepository;

        public string InstallId { get; private set; }

        public AnalyticsService(
            IPreferenceRepository preferenceRepository)
        {
            _preferenceRepository = preferenceRepository;

            InstallId = GetInstallId();

            TrackStartup();
        }

        public async Task Track()
        {
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

        private async void TrackStartup()
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
