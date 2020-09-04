using WowUp.WPF.Entities;

namespace WowUp.WPF.Models.Events
{
    public class PreferenceEventArgs
    {
        public Preference Preference { get; }

        public PreferenceEventArgs(Preference preference)
        {
            Preference = preference;
        }
    }
}
