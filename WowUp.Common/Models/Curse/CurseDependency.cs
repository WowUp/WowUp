namespace WowUp.Common.Models.Curse
{
    public class CurseDependency
    {
        public long Id { get; set; }
        public int AddonId { get; set; }
        public CurseDependencyType Type { get; set; }
        public int FileId { get; set; }
    }
}
