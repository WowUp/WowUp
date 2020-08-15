using Flurl.Http;
using Microsoft.Extensions.Caching.Memory;
using System;
using System.Threading.Tasks;
using WowUp.Common.Models.WowUpApi.Response;
using WowUp.Common.Services.Contracts;
using WowUp.WPF.Extensions;

namespace WowUp.WPF.Services
{
    public class WowUpApiService : IWowUpApiService
    {
        const string ApiUrl = "https://4g2nuwcupj.execute-api.us-east-1.amazonaws.com/production";

        private readonly IMemoryCache _memoryCache;

        public WowUpApiService(
            IMemoryCache memoryCache)
        {
            _memoryCache = memoryCache;

        }

        public async Task<LatestVersionResponse> GetLatestVersion()
        {
            var url = $"{ApiUrl}/wowup/latest";

            if (_memoryCache.TryGetValue(url, out var cachedVersion))
            {
                return cachedVersion as LatestVersionResponse;
            }

            var response = await url.GetJsonAsync<LatestVersionResponse>();

            _memoryCache.CacheForAbsolute(url, response, TimeSpan.FromMinutes(60));

            return response;
        }
    }
}
