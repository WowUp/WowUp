using WowUp.Common.Enums;

namespace WowUp.Common.Models.Addons
{
    public class AddonSearchResultDependency
    {
        public int AddonId { get; set; }
        public AddonDependencyType Type { get; set; }
    }
}