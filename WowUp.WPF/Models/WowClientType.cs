using System.ComponentModel.DataAnnotations;

namespace WowUp.WPF.Models
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
        ClassicPtr
    }
}
