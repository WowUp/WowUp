using WowUp.Common.Models.Curse;
using WowUp.WPF.AddonProviders.Curse;
using WowUp.WPF.Models.WowUp;

namespace WowUp.WPF.Models.Curse
{
    public class CurseScanResult
    {
        public CurseFolderScanner FolderScanner { get; set; }
        public AddonFolder AddonFolder { get; set; }
        public CurseMatch ExactMatch { get; set; }
        public CurseSearchResult SearchResult { get; set; }
    }
}
