using System.Collections.Generic;

namespace WowUp.Common.Models.WowInterface
{
    public class AddonDetailsResponse
    {
        public int Id { get; set; }
        public int CategoryId { get; set; }
        public string Version { get; set; }
        public long LastUpdate{ get; set; }
        public string Checksum{ get; set; }
        public string FileName { get; set; }
        public string DownloadUri { get; set; }
        public string PendingUpdate { get; set; }
        public string Title { get; set; }
        public string Author { get; set; }
        public string Description { get; set; }
        public string ChangeLog { get; set; }
        public long Downloads { get; set; }
        public int DownloadsMonthly { get; set; }
        public int Favorites { get; set; }

        public IEnumerable<Image> Images { get; set; }
    }
}
