using System;
using WowUp.Common.Enums;

namespace WowUp.WPF.Extensions
{
    public static class EnumExtensions
    {
        public static AddonChannelType ToAddonChannelType(this string str)
        {
            if (AddonChannelType.Alpha.ToString().Equals(str, StringComparison.OrdinalIgnoreCase))
            {
                return AddonChannelType.Alpha;
            }
            else if (AddonChannelType.Beta.ToString().Equals(str, StringComparison.OrdinalIgnoreCase))
            {
                return AddonChannelType.Beta;
            }

            return AddonChannelType.Stable;
        }

        public static WowUpReleaseChannelType ToWowUpReleaseChannelType(this string str)
        {
            if (WowUpReleaseChannelType.Stable.ToString().Equals(str, StringComparison.OrdinalIgnoreCase))
            {
                return WowUpReleaseChannelType.Stable;
            }
            else if (WowUpReleaseChannelType.Beta.ToString().Equals(str, StringComparison.OrdinalIgnoreCase))
            {
                return WowUpReleaseChannelType.Beta;
            }

            return WowUpReleaseChannelType.Stable;
        }
    }
}
