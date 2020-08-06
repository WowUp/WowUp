using WowUp.Common.Enums;
using WowUp.WPF.Entities;

namespace WowUp.WPF.Models.Events
{
    public class AddonEventArgs
    {
        public AddonEventArgs(Addon addon, AddonChangeType changeType)
        {
            Addon = addon;
            ChangeType = changeType;
        }

        public Addon Addon { get; set; }

        public AddonChangeType ChangeType { get; set; }
    }
}
