using Newtonsoft.Json;

namespace WowUp.Common.Models.GitHub
{
    public class GitHubRepository
    {
        public long Id { get; set; }

        [JsonProperty("node_id")]
        public string NodeId { get; set; }

        public string Name { get; set; }

        [JsonProperty("full_name")]
        public string FullName { get; set; }

        public bool Private { get; set; }

        public GitHubUploader Owner { get; set; }

        [JsonProperty("html_url")]
        public string HtmlUrl { get; set; }

        public string Description { get; set; }

        public bool Fork { get; set; }

        public string Url { get; set; }
    }
}
