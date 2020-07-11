using WowUp.WPF.Entities;

namespace WowUp.WPF.Models.Events
{
    public class AddonEventArgs
    {
        public AddonEventArgs(Addon addon)
        {
            Addon = addon;
        }

        public Addon Addon { get; set; }
    }
}
