using System.Collections.Generic;

namespace WowUp.Common.Models.Curse
{
    public class CurseMatch
    {
        public int Id { get; set; }
        public CurseFile File { get; set; }
        public IEnumerable<CurseFile> LatestFiles { get; set; }
    }
}
