using System;
using System.Threading.Tasks;

namespace WowUp.Common.Services.Contracts
{
    public interface ICacheService
    {
        Task<T> GetCache<T>(string cacheKey, Func<Task<T>> fallbackAction, int ttlMinutes = 60);
    }
}
