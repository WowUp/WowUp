using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;
using System.Linq;
using System.Reflection;
using System.Text;

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
