using WowUp.WPF.Entities;
using WowUp.WPF.Models;

namespace WowUp.WPF.Extensions
{
    public static class AddonExtensions
    {
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
