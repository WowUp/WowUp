using WowUp.WPF.Entities;
using WowUp.WPF.Models;

namespace WowUp.WPF.Repositories.Contracts
{
    public interface IAddonRepository : IDataStore<Addon>
    {
        Addon GetByExternalId(string externalId, WowClientType clientType);
    }
}
