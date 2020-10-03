using System.ComponentModel.DataAnnotations;

namespace WowUp.Common.Enums
{
    public enum AddonChannelType
    {
        [Display(Name = "Stable")]
        Stable,
        [Display(Name = "Beta")]
        Beta,
        [Display(Name = "Alpha")]
        Alpha
    }
}
