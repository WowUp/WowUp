using System;
using System.ComponentModel.DataAnnotations;
using System.Linq;
using System.Reflection;

namespace WowUp.WPF.Utilities
{
    public static class EnumUtilities
    {
        public static string GetDisplayName(Enum val)
        {
            return val.GetType()
                            .GetMember(val.ToString())
                            .First()
                            .GetCustomAttribute<DisplayAttribute>()
                            .GetName();
        }
    }
}
