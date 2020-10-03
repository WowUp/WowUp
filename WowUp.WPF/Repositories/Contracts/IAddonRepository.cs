using WowUp.Common.Enums;
using WowUp.WPF.Entities;

namespace WowUp.WPF.Repositories.Contracts
{
    public interface IAddonRepository : IDataStore<Addon>
    {
        Addon GetByExternalId(string externalId, WowClientType clientType);
    }
}
