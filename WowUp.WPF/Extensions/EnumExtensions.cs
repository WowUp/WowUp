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
    }
}
