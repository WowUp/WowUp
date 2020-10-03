namespace WowUp.Common.Models.Curse
{
    public class CurseAuthor
    {
        public string Name { get; set; }
        public string Url { get; set; }
        public int ProjectId { get; set; }
        public int Id { get; set; }
        public int? ProjectTitleId { get; set; }
        public string ProjectTitleTitle { get; set; }
        public int UserId { get; set; }
        public int? TwitchId { get; set; }
    }
}
