using WowUp.Common.Enums;
using WowUp.WPF.Entities;

namespace WowUp.WPF.Models.Events
{
    public class AddonStateEventArgs
    {
        public Addon Addon { get; set; }
        public AddonInstallState AddonInstallState { get; set; }
        public decimal Progress { get; set; }
    }
}
