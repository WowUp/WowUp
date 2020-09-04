using WowUp.Common.Models;

namespace WowUp.WPF.Extensions
{
    public static class PotentialAddonExtensions
    {
        public static string GetThumbnailUrl(this PotentialAddon addon)
        {
            return string.IsNullOrEmpty(addon.ThumbnailUrl)
                ? "pack://application:,,,/WowUp;component/Assets/wowup_logo_1.png"
                : addon.ThumbnailUrl;
        }
    }
}
