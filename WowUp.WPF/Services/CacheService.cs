using Microsoft.Extensions.Caching.Memory;
using System;
using System.Threading.Tasks;
using WowUp.Common.Services.Contracts;
using WowUp.WPF.Extensions;

namespace WowUp.WPF.Services
{
    public class CacheService : ICacheService
    {
        private readonly IMemoryCache _cache;

        public CacheService(IMemoryCache memoryCache)
        {
            _cache = memoryCache;
        }

        public async Task<T> GetCache<T>(
            string cacheKey, 
            Func<Task<T>> fallbackAction, 
            int ttlMinutes = 10)
        {
            if (_cache.TryGetValue(cacheKey, out var cachedItem))
            {
                return (T)cachedItem;
            }

            var result = await fallbackAction.Invoke();
               
            if(result != null)
            {
                _cache.CacheForAbsolute(cacheKey, result, TimeSpan.FromMinutes(ttlMinutes));
            }

            return result;
        }
    }
}
