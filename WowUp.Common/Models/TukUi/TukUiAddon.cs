using Newtonsoft.Json;
using System;

namespace WowUp.Common.Models.TukUi
{
    public class TukUiAddon
    {
        public string Id { get; set; }
        public string Name { get; set; }

        [JsonProperty("small_desc")]
        public string SmallDesc { get; set; }
        public string Author { get; set; }
        public string Version { get; set; }

        [JsonProperty("screenshot_url")]
        public string ScreenshotUrl { get; set; }

        public string Url { get; set; }
        public string Category { get; set; }
        public string Downloads { get; set; }
        public DateTime LastUpdate { get; set; }
        public string Patch { get; set; }

        [JsonProperty("web_url")]
        public string WebUrl { get; set; }

        [JsonProperty("last_download")]
        public string LastDownload { get; set; }
        public string Changelog { get; set; }

        [JsonProperty("donate_url")]
        public string DonateUrl { get; set; }
    }
}
