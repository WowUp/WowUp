using System;
using System.Collections.Generic;
using WowUp.Common.Enums;

namespace WowUp.Common.Models.Addons
{
    public class AddonSearchResultFile
    {
        public AddonChannelType ChannelType { get; set; }
        public string Version { get; set; }
        public IEnumerable<string> Folders { get; set; }
        public string GameVersion { get; set; }
        public string DownloadUrl { get; set; }
        public DateTime ReleaseDate { get; set; }
        public IEnumerable<AddonSearchResultDependency> Dependencies { get; set; }
    }
}
