using System.Diagnostics;
using System.Text.RegularExpressions;

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

        public static string TrimSemVerString(this string semVer)
        {
            var regex = new Regex(@"^v?(\d+.\d+.\d+)");
            var match = regex.Match(semVer);
            if (!match.Success)
            {
                return string.Empty;
            }

            return match.Groups[1].Value;
        }
    }
}
