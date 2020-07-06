using System.Diagnostics;

namespace WowUp.WPF.Extensions
{
    public static class StringExtensions
    {
        public static void OpenUrlInBrowser(this string url)
        {
            Process.Start(new ProcessStartInfo(url) { UseShellExecute = true });
        }
    }
}
