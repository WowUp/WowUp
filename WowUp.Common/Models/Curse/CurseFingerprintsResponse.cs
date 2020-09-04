using System.Collections.Generic;

namespace WowUp.Common.Models.Curse
{
    public class CurseFingerprintsResponse
    {
        public bool IsCacheBuild { get; set; }
        public List<CurseMatch> ExactMatches { get; set; }
        public List<long> ExactFingerprints { get; set; }
        public List<CurseMatch> PartialMatches { get; set; }
        public Dictionary<string, List<long>> PartialMatchFingerprints { get; set; }
        public List<long> InstalledFingerprints { get; set; }
        public List<long> UnmatchedFingerprints { get; set; }
    }
}
