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
        Task Track(Exception ex, bool isFatal = false, string message = "");
        void Track(Exception ex, string message = "");
        Task TrackUserAction(string category, string action, string label = null);

        string InstallId { get; }
    }
}
