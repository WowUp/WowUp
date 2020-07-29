using Newtonsoft.Json;
using System;

namespace WowUp.Common.Models.GitHub
{
    public class GitHubAsset
    {
        public string Url { get; set; }
        
        public long Id { get; set; }
        
        [JsonProperty("node_id")]
        public string NodeId { get; set; }
        
        public string Name { get; set; }
        
        public string Label { get; set; }

        public GitHubUploader Uploader { get; set; }

        [JsonProperty("content_type")]
        public string ContentType { get; set; }

        public string State { get; set; }

        public long Size { get; set; }

        [JsonProperty("download_count")]
        public int DownloadCount { get; set; }

        [JsonProperty("created_at")]
        public DateTime CreatedAt { get; set; }

        [JsonProperty("updated_at")]
        public DateTime UpdatedAt { get; set; }

        [JsonProperty("browser_download_url")]
        public string BrowserDownloadUrl { get; set; }
    }
}
