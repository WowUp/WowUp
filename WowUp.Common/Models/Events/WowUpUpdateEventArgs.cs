using WowUp.Common.Enums;

namespace WowUp.Common.Models.Events
{
    public class WowUpUpdateEventArgs
    {
        public ApplicationUpdateState State { get; set; }
        public decimal Progress { get; set; }

        public WowUpUpdateEventArgs(
            ApplicationUpdateState state,
            decimal progress = 0.0m)
        {
            State = state;
            Progress = progress;
        }
    }
}
