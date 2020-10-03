using System.Collections.Generic;

namespace WowUp.Common.Models.Addons
{
    public class AddonSearchResult
    {
        public string Name { get; set; }
        public string Author { get; set; }
        public string ThumbnailUrl { get; set; }
        public string ExternalId { get; set; }
        public string ExternalUrl { get; set; }
        public string ProviderName { get; set; }

        public IEnumerable<AddonSearchResultFile> Files { get; set; }
    }
}
