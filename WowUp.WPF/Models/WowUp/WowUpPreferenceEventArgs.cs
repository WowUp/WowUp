using WowUp.WPF.Entities;

namespace WowUp.WPF.Models.WowUp
{
    public class WowUpPreferenceEventArgs
    {
        public Preference Preference { get; }

        public WowUpPreferenceEventArgs(Preference preference)
        {
            Preference = preference;
        }
    }
}
