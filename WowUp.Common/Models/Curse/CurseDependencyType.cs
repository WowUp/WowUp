using WowUp.Common.Enums;

namespace WowUp.Common.Models.Curse
{
    public enum CurseDependencyType
    {
        EmbeddedLib = 1,
        Optional = 2,
        Required = 3,
        Tool = 4,
        Incompatible = 5,
        Include = 6
    }

    public static class CurseDependencyExtensions
    {
        public static AddonDependencyType AsAddonDependencyType(this CurseDependencyType dependencyType)
        {
            return dependencyType switch
            {
                CurseDependencyType.EmbeddedLib => AddonDependencyType.EmbeddedLib,
                CurseDependencyType.Optional => AddonDependencyType.Optional,
                CurseDependencyType.Required => AddonDependencyType.Required,
                _ => AddonDependencyType.Other
            };
        }
    }
}