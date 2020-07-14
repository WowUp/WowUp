using System.Collections.Generic;
using System.Linq;
using WowUp.Common.Enums;
using WowUp.WPF.Entities;
using WowUp.WPF.Models;

namespace WowUp.WPF.Extensions
{
    public static class AddonExtensions
    {
        public static IList<string> GetInstalledDirectories(this Addon addon)
        {
            if (string.IsNullOrEmpty(addon.InstalledFolders))
            {
                return new List<string>();
            }

            return addon.InstalledFolders.Split(',').ToList();
        }

        public static bool CanInstall(this Addon addon)
        {
            return addon.GetDisplayState() == AddonDisplayState.Install;
        }

        public static bool CanUpdate(this Addon addon)
        {
            return addon.GetDisplayState() == AddonDisplayState.Update;
        }

        public static AddonDisplayState GetDisplayState(this Addon addon)
        {
            if(addon == null)
            {
                return AddonDisplayState.Unknown;
            }

            if (addon.IsIgnored)
            {
                return AddonDisplayState.Ignored;
            }

            if (string.IsNullOrEmpty(addon.InstalledVersion))
            {
                return AddonDisplayState.Install;
            }

            if (addon.InstalledVersion != addon.LatestVersion)
            {
                return AddonDisplayState.Update;
            }

            if (addon.InstalledVersion == addon.LatestVersion)
            {
                return AddonDisplayState.UpToDate;
            }

            return AddonDisplayState.Unknown;
        }
    }
}
