using Flurl.Http;
using System.Threading.Tasks;
using WowUp.Common.Models.WowUpApi.Response;
using WowUp.Common.Services.Contracts;
using WowUp.WPF.Utilities;

namespace WowUp.WPF.Services
{
    public class WowUpApiService : IWowUpApiService
    {
        const string ApiUrl = "https://4g2nuwcupj.execute-api.us-east-1.amazonaws.com/production";

        public async Task<LatestVersionResponse> GetLatestVersion()
        {
            var url = $"{ApiUrl}/wowup/latest";

            return await url
                .WithHeaders(HttpUtilities.DefaultHeaders)
                .GetJsonAsync<LatestVersionResponse>();
        }

        public async Task<AppCenterResponse> GetAppCenter()
        {
            var url = $"{ApiUrl}/wowup/appcenter";

            return await url
                .WithHeaders(HttpUtilities.DefaultHeaders)
                .GetJsonAsync<AppCenterResponse>();
        }
    }
}
