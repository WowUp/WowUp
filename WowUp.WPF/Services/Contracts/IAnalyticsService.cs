using System;
using System.Threading.Tasks;

namespace WowUp.WPF.Services.Contracts
{
    public interface IAnalyticsService
    {
        void SetTelemetryEnabled(bool enabled);
        bool IsTelemetryEnabled();
        void PromptTelemetry();
        Task TrackStartup();
        Task Track(Exception ex, bool isFatal);

        string InstallId { get; }
    }
}
