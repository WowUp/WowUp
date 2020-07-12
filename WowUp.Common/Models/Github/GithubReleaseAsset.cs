using Newtonsoft.Json;
using System;
using System.Collections.Generic;
using System.Text;

namespace WowUp.Common.Models.Github
{
    public class GithubReleaseAsset
    {
        public string Url { get; set; }
        public long Id { get; set; }
        public string Name { get; set; }
        public string Label { get; set; }
        
        [JsonProperty("content_type")]
        public string ContentType { get; set; }

        public string State { get; set; }
        public long Size { get; set; }

        [JsonProperty("download_count")]
        public int DownloadCount { get; set; }
    }
}
