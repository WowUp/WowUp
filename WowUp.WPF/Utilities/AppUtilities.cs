using System;
using System.Diagnostics;
using System.IO;
using System.Windows;

namespace WowUp.WPF.Utilities
{
    public static class AppUtilities
    {
        public static string LongVersionName => FileVersionInfo.GetVersionInfo(typeof(App).Assembly.Location).ProductVersion;
        public static bool IsBetaBuild => LongVersionName.Contains("beta", StringComparison.OrdinalIgnoreCase);
        public static Version CurrentVersion => typeof(App).Assembly.GetName().Version;
        public static string CurrentVersionString => typeof(App).Assembly.GetName().Version.ToString();
        public static string ApplicationFilePath => Process.GetCurrentProcess().MainModule.FileName;
        public static string ApplicationFileName => Path.GetFileName(ApplicationFilePath);

        public static void RestartApplication()
        {
            Application.Current.MainWindow?.Close();
            Application.Current.Shutdown();
            Process.Start(FileUtilities.ExecutablePath);
        }
    }
}
