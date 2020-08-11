namespace WowUp.Common.Models
{
    public class Toc
    {
        public string Interface { get; set; }
        public string Title { get; set; }
        public string Author { get; set; }
        public string Website { get; set; }
        public string Version { get; set; }
        public string PartOf { get; set; }
        public string Category { get; set; }
        public string Localizations { get; set; }
        public string Dependencies { get; set; }

        public string CurseProjectId { get; set; }
        public string WowInterfaceId { get; set; }
        public string TukUiProjectId { get; set; }
        public string TukUiProjectFolders { get; set; }
    }
}
