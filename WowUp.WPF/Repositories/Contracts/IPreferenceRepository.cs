using System.Collections.Generic;
using WowUp.WPF.Entities;

namespace WowUp.WPF.Repositories.Contracts
{
    public interface IPreferenceRepository : IDataStore<Preference>
    {
        Preference Create(string key, string value);
        Preference FindByKey(string key);
        IList<Preference> FindAllByKey(IEnumerable<string> keys);
    }
}
