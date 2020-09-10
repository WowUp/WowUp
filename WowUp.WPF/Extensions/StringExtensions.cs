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
            var regex = new Regex(@"^v?(?<version>\d+.\d+.\d+)(?<build>.\d+)?(-beta\.)?(?<beta>\d+)?$");
            var match = regex.Match(semVer);
            if (!match.Success)
            {
                return string.Empty;
            }

            var version = match.Groups["version"]?.Value;
            var betaVersion = match.Groups["beta"]?.Value;
            betaVersion = string.IsNullOrEmpty(betaVersion)
                ? ".0"
                : $".{betaVersion}";

            return $"{version}{betaVersion}";
        }

    }
}
