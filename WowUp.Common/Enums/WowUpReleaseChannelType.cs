using System.ComponentModel.DataAnnotations;

namespace WowUp.Common.Enums
{
    public enum WowUpReleaseChannelType
    {
        [Display(Name = "Beta")]
        Beta,
        [Display(Name = "Stable")]
        Stable
    }
}
