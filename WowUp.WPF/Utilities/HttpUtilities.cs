using System;
using System.Collections.Generic;
using System.Text;

namespace WowUp.WPF.Utilities
{
    public static class HttpUtilities
    {
        public const string UserAgent = "WowUp-Client (+https://wowup.io)";

        public static object DefaultHeaders => new { User_Agent = UserAgent };
    }
}
