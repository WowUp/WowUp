using Serilog;
using System;
using System.Globalization;
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
                try
                {

                    BitmapImage thumbnail = new BitmapImage();
                    thumbnail.BeginInit();
                    thumbnail.DecodePixelWidth = 80;

                    if (uri.IsFile)
                    {
                        thumbnail.StreamSource = FileUtilities.GetMemoryStreamFromFile(uri.AbsolutePath);
                    }
                    else
                    {
                        thumbnail.UriSource = uri;
                    }

                    thumbnail.CacheOption = BitmapCacheOption.OnLoad;
                    thumbnail.EndInit();
                    return thumbnail;
                }
                catch (Exception ex)
                {
                    Log.Error(ex, "Failed to create bitmap image");
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
