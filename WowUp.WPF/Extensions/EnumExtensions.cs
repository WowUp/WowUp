using System;
using WowUp.Common.Enums;

namespace WowUp.WPF.Extensions
{
    public static class EnumExtensions
    {
        public static AddonChannelType ToAddonChannelType(this string str)
        {
            var parsed = Enum.TryParse<AddonChannelType>(str, true, out var result);
            return parsed ? result : AddonChannelType.Stable;
        }

        public static WowClientType ToWowClientType(this string str)
        {
            var parsed = Enum.TryParse<WowClientType>(str, true, out var result);
            return parsed ? result : WowClientType.None;
        }

        public static WowUpReleaseChannelType ToWowUpReleaseChannelType(this string str)
        {
            var parsed = Enum.TryParse<WowUpReleaseChannelType>(str, true, out var result);
            return parsed ? result : WowUpReleaseChannelType.Stable;
        }
    }
}
