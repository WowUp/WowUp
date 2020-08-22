using System.Collections.Generic;

namespace WowUp.Common.Models.Curse
{
    public class CurseFingerprintsResponse
    {
        public bool IsCacheBuild { get; set; }
        public IEnumerable<CurseMatch> ExactMatches { get; set; }
        public IEnumerable<long> ExactFingerprints { get; set; }
        public IEnumerable<CurseMatch> PartialMatches { get; set; }
        public Dictionary<string, IEnumerable<long>> PartialMatchFingerprints { get; set; }
        public IEnumerable<long> InstalledFingerprints { get; set; }
        public IEnumerable<long> UnmatchedFingerprints { get; set; }
    }
}
