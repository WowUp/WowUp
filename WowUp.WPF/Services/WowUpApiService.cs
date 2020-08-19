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

        private readonly ICacheService _cacheService;

        public WowUpApiService(
            ICacheService cacheService)
        {
            _cacheService = cacheService;
        }

        public async Task<LatestVersionResponse> GetLatestVersion()
        {
            var url = $"{ApiUrl}/wowup/latest";

            return await _cacheService.GetCache(url, async () =>
            {
                return await url
                    .WithHeaders(HttpUtilities.DefaultHeaders)
                    .GetJsonAsync<LatestVersionResponse>();
            });
        }
    }
}
