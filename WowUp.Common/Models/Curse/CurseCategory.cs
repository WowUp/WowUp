namespace WowUp.Common.Models.Curse
{
    public class CurseCategory
    {
        public int CategoryId { get; set; }
        public string Name { get; set; }
        public string Url { get; set; }
        public string AvatarUrl { get; set; }
        public int ParentId { get; set; }
        public int RootId { get; set; }
        public int ProjectId { get; set; }
        public int AvatarId { get; set; }
        public int GameId { get; set; }
    }
}
