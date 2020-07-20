using WowUp.WPF.Repositories.Base;
using WowUp.WPF.Repositories.Contracts;
using WowUp.WPF.Services.Contracts;

namespace WowUp.WPF.Services
{
    public class MigrationService : IMigrationService
    {
        public MigrationService(
            IAddonRepository addonRepository,
            IPreferenceRepository preferenceRepository)
        {
        }

        public void MigrateDatabase()
        {
            new BaseRepository().MigrateDatabase();
        }
    }
}
