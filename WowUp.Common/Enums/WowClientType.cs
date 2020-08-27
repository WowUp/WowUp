using System.ComponentModel.DataAnnotations;

namespace WowUp.Common.Enums
{
    public enum WowClientType
    {
        [Display(Name = "Retail")]
        Retail,
        [Display(Name = "Classic")]
        Classic,
        [Display(Name = "Retail PTR")]
        RetailPtr,
        [Display(Name = "Classic PTR")]
        ClassicPtr,
        [Display(Name = "Beta")]
        Beta,
        None
    }
}
