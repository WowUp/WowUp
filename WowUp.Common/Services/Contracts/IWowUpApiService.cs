using System.Threading.Tasks;
using WowUp.Common.Models.WowUpApi.Response;

namespace WowUp.Common.Services.Contracts
{
    public interface IWowUpApiService
    {
        Task<LatestVersionResponse> GetLatestVersion();
        Task<AppCenterResponse> GetAppCenter();
    }
}
