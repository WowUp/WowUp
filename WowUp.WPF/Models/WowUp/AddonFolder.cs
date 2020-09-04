using System.Collections.Generic;
using System.IO;
using WowUp.Common.Models;
using WowUp.WPF.Entities;

namespace WowUp.WPF.Models.WowUp
{
    public class AddonFolder
    {
        public DirectoryInfo Directory { get; set; }
        public string Name { get; set; }
        public string Path { get; set; }
        public string Status { get; set; }
        public string ThumbnailUrl { get; set; }
        public string LatestVersion { get; set; }

        public Toc Toc { get; set; }
        public IList<string> TocMetaData { get; set; }

        public Addon MatchingAddon { get; set; }
    }
}
