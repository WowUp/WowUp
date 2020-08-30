using System;
using System.Globalization;
using System.Windows.Data;
using System.Windows.Media.Imaging;

namespace WowUp.WPF.Converters
{
    public class UriToThumbnailConverter : IValueConverter
    {
        public object Convert(object value, Type targetType, object parameter, CultureInfo culture)
        {
            if (value == null)
            {
                return null;
            }

            if (value is string uriStr)
            {
                value = new Uri(uriStr);
            }

            if (value is Uri uri)
            {
                BitmapImage thumbnail = new BitmapImage();
                thumbnail.BeginInit();
                thumbnail.DecodePixelWidth = 80;
                thumbnail.UriSource = uri;
                thumbnail.EndInit();
                return thumbnail;
            }

            return null;
        }

        public object ConvertBack(object value, Type targetType, object parameter, CultureInfo culture)
        {
            throw new NotImplementedException();
        }
    }
}
