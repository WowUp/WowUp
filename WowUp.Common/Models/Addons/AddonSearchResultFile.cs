using System;
using System.Collections.Generic;
using System.Text;
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
    }
}
