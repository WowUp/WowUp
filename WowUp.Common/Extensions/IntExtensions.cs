namespace WowUp.Common.Extensions
{
    public static class IntExtensions
    {
        public static string FormatDownloadCount(this int downloadCount)
        {
            var suffix = string.Empty;
            var value = (double)downloadCount;
            if (downloadCount >= 1000000)
            {
                suffix = "million";
                value /= 1000000.0;
            }
            else if (downloadCount >= 1000)
            {
                suffix = "thousand";
                value /= 1000.0;
            }

            return $"{value:0.0} {suffix}";
        }
    }
}
