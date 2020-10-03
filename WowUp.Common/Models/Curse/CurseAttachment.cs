namespace WowUp.Common.Models.Curse
{
    public class CurseAttachment
    {
        public int Id { get; set; }
        public int ProjectId { get; set; }
        public string Description { get; set; }
        public bool IsDefault { get; set; }
        public string ThumbnailUrl { get; set; }
        public string Title { get; set; }
        public string Url { get; set; }
        public int Status { get; set; }
    }
}
