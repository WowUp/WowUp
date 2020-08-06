using System.Collections.Generic;
using System.Linq;
using WowUp.Common.Enums;
using WowUp.WPF.Entities;

namespace WowUp.WPF.Extensions
{
    public static class AddonExtensions
    {
        public static Addon Assign(this Addon addon1, Addon addon2)
        {
            addon1.Name = addon2.Name;
            addon1.FolderName = addon2.FolderName;
            addon1.DownloadUrl = addon2.DownloadUrl;
            addon1.LatestVersion = addon2.LatestVersion;
            addon1.ExternalId = addon2.ExternalId;
            addon1.ProviderName = addon2.ProviderName;
            addon1.ExternalUrl = addon2.ExternalUrl;
            addon1.ThumbnailUrl = addon2.ThumbnailUrl;
            addon1.GameVersion = addon2.GameVersion;
            addon1.ClientType = addon2.ClientType;
            addon1.ChannelType = addon2.ChannelType;

            return addon1;
        }

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
