using System;
using System.Collections;
using System.Globalization;
using Xamarin.Forms;

namespace WowUp.Converters
{
    public class ArrayLengthToBoolConvert : IValueConverter
    {
        public object Convert(object value, Type targetType, object parameter, CultureInfo culture)
        {
            return ((ICollection)value).Count != 0;
        }

        public object ConvertBack(object value, Type targetType, object parameter, CultureInfo culture)
        {
            return null;
        }
    }
}
