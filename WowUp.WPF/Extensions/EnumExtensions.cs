using System;
using System.ComponentModel.DataAnnotations;
using System.Linq;
using System.Reflection;
using WowUp.WPF.Models;

namespace WowUp.WPF.Extensions
{
    public static class EnumExtensions
    {
        public static string GetDisplayName(this Enum val)
        {
            return val.GetType()
                            .GetMember(val.ToString())
                            .First()
                            .GetCustomAttribute<DisplayAttribute>()
                            .GetName();
        }

        public static bool IsRetail(this WowClientType clientType)
        {
            return clientType == WowClientType.Retail || clientType == WowClientType.RetailPtr;
        }

        public static bool IsClassic(this WowClientType clientType)
        {
            return clientType == WowClientType.Classic || clientType == WowClientType.ClassicPtr;
        }
    }
}
