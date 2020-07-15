using System;

namespace WowUp.WPF.Utilities
{
    public static class HttpUtilities
    {
        public static string BitStr => Environment.Is64BitOperatingSystem ? "x64" : "x86";
        public static string UserAgent => $"WowUp-Client/{AppUtilities.CurrentVersionString} ({Environment.OSVersion.VersionString}; {BitStr}; +https://wowup.io)";

        public static object DefaultHeaders => new { User_Agent = UserAgent };
    }
}
