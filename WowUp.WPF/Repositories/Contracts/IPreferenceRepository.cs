using WowUp.WPF.Entities;

namespace WowUp.WPF.Repositories.Contracts
{
    public interface IPreferenceRepository : IDataStore<Preference>
    {
        Preference FindByKey(string key);
    }
}
