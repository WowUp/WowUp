using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;
using System.Linq;
using System.Reflection;
using WowUp.Common.Enums;

namespace WowUp.Common.Extensions
{
    public static class EnumExtensions
    {
        public static List<T> Values<T>() where T : struct, IComparable, IFormattable, IConvertible
        {
            if (!typeof(T).IsEnum)
                throw new InvalidOperationException(string.Format("Type {0} is not enum.", typeof(T).FullName));

            return Enum.GetValues(typeof(T)).Cast<T>().ToList();
        }

        public static string GetDisplayName(this Enum val)
        {
            return val
                .GetType()
                .GetMember(val.ToString())
                .First()
                .GetCustomAttribute<DisplayAttribute>()
                .GetName();
        }

        public static bool IsRetail(this WowClientType clientType)
        {
            return clientType == WowClientType.Retail ||
                clientType == WowClientType.RetailPtr ||
                clientType == WowClientType.Beta;
        }

        public static bool IsClassic(this WowClientType clientType)
        {
            return clientType == WowClientType.Classic ||
                clientType == WowClientType.ClassicPtr;
        }
    }
}
