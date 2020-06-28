namespace WowUp.Models.Curse
{
    public class CurseDependency
    {
        public long Id { get; set; }
        public int AddonId { get; set; }
        public int Type { get; set; }
        public int FileId { get; set; }
    }
}
