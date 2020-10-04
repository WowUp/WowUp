using Serilog;
using System;
using System.Globalization;
using System.IO;
using System.Windows.Data;
using System.Windows.Media.Imaging;
using WowUp.WPF.Utilities;

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
                MemoryStream imageStream = null;

                try
                {
                    BitmapImage thumbnail = new BitmapImage();
                    thumbnail.BeginInit();
                    thumbnail.DecodePixelWidth = 80;
                    thumbnail.CreateOptions = BitmapCreateOptions.IgnoreImageCache;
                    thumbnail.CacheOption = BitmapCacheOption.OnLoad;
                    thumbnail.UriSource = uri;
                    thumbnail.EndInit();
                    return thumbnail;
                }
                catch (Exception ex)
                {
                    Log.Error(ex, "Failed to create bitmap image");
                }
                finally
                {
                    imageStream?.Close();
                    imageStream?.Dispose();
                }
            }

            return null;
        }

        public object ConvertBack(object value, Type targetType, object parameter, CultureInfo culture)
        {
            throw new NotImplementedException();
        }
    }
}
