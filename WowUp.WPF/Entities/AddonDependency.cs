using SQLite;
using WowUp.Common.Enums;

namespace WowUp.WPF.Entities
{
    [Table("AddonDependencies")]
    public class AddonDependency : BaseEntity
    {
        private int _addonId;
        [NotNull, Indexed(Name = "CompositeKey", Order = 1)]
        public int AddonId
        {
            get => _addonId;
            set => SetProperty(ref _addonId, value);
        }

        private int _dependencyId;
        [NotNull, Indexed(Name = "CompositeKey", Order = 2)]
        public int DependencyId
        {
            get => _dependencyId;
            set => SetProperty(ref _dependencyId, value);
        }

        private AddonDependencyType _type;
        public AddonDependencyType Type
        {
            get => _type;
            set => SetProperty(ref _type, value);
        }
    }
}