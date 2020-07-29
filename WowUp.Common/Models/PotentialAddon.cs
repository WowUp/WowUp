namespace WowUp.Common.Models
{
    public class PotentialAddon
    {
        public string Name { get; set; }
        public string ProviderName { get; set; }
        public string ThumbnailUrl { get; set; }
        public string ExternalId { get; set; }
        public string ExternalUrl { get; set; }
        public string Author { get; set; }
        public int DownloadCount { get; set; }
    }
}
