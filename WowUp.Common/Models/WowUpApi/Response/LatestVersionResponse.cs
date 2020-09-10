namespace WowUp.Common.Models.WowUpApi.Response
{
    public class LatestVersionResponse : LatestVersion
    {
        public LatestVersion Beta { get; set; }
        public LatestVersion Stable { get; set; }
        public LatestVersion Updater { get; set; }
    }
}
