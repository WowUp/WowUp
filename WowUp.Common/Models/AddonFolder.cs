using System.Collections;
using System.Collections.Generic;

namespace WowUp.Common.Models
{
    public class AddonFolder
    {
        public string Name { get; set; }
        public string Path { get; set; }
        public string Status { get; set; }
        public string ThumbnailUrl { get; set; }
        public string LatestVersion { get; set; }

        public Toc Toc { get; set; }
        public IList<string> TocMetaData { get; set; }
    }
}
