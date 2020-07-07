using System.Diagnostics;

namespace WowUp.WPF.Extensions
{
    public static class StringExtensions
    {
        public static void OpenUrlInBrowser(this string url)
        {
            if (string.IsNullOrEmpty(url))
            {
                return;
            }

            Process.Start(new ProcessStartInfo(url) { UseShellExecute = true });
        }
    }
}
