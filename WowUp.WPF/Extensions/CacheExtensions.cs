using Microsoft.Extensions.Caching.Memory;
using System;

namespace WowUp.WPF.Extensions
{
    public static class CacheExtensions
    {
        public static void CacheForAbsolute(this IMemoryCache cache, string cacheKey, object value, TimeSpan expiresIn)
        {
            if (cache == null)
            {
                return;
            }

            var cacheEntryOptions = new MemoryCacheEntryOptions()
                    .SetAbsoluteExpiration(expiresIn);

            cache.Set(cacheKey, value, cacheEntryOptions);
        }
    }
}
