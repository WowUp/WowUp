using System;

namespace WowUp.WPF.Utilities
{
    public static class AppUtilities
    {
        public static Version CurrentVersion => typeof(App).Assembly.GetName().Version;
        public static string CurrentVersionString => typeof(App).Assembly.GetName().Version.ToString();
    }
}
