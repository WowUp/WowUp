namespace WowUp.Models
{
    public class LocalAddon
    {
        public string Name { get; set; }
        public string Status { get; set; }
        public string CurrentVersion { get; set; }
        public string LatestVersion { get; set; }
        public string ThumbnailUrl { get; set; }

        public AddonSearchResult SearchResult { get; set; }
    }
}
