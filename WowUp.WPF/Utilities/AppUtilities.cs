using System;
using System.Diagnostics;
using System.Reflection;

namespace WowUp.WPF.Utilities
{
    public static class AppUtilities
    {
        public static string LongVersionName => FileVersionInfo.GetVersionInfo(typeof(App).Assembly.Location).ProductVersion;
        public static bool IsBetaBuild => LongVersionName.Contains("beta", StringComparison.OrdinalIgnoreCase);
        public static Version CurrentVersion => typeof(App).Assembly.GetName().Version;
        public static string CurrentVersionString => typeof(App).Assembly.GetName().Version.ToString();
    }
}
