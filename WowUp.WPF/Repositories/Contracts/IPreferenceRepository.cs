using System.Collections.Generic;
using WowUp.WPF.Entities;
using WowUp.WPF.Models.Events;

namespace WowUp.WPF.Repositories.Contracts
{
    public delegate void PreferenceEventHandler(object sender, PreferenceEventArgs e);

    public interface IPreferenceRepository : IDataStore<Preference>
    {
        event PreferenceEventHandler PreferenceUpdated;

        Preference Create(string key, string value);
        Preference FindByKey(string key);
        IList<Preference> FindAllByKey(IEnumerable<string> keys);
    }
}
