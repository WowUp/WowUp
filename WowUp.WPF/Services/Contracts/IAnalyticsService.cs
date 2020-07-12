using System.Threading.Tasks;

namespace WowUp.WPF.Services.Contracts
{
    public interface IAnalyticsService
    {
        void SetTelemetryEnabled(bool enabled);
        bool IsTelemetryEnabled();
        void PromptTelemetry();
        Task TrackStartup();

        string InstallId { get; }
    }
}
