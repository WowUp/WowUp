using System;

namespace WowUp.Common.Models.Curse
{
    public class CurseSortableGameVersion
    {
        public string GameVersionPadded { get; set; }
        public string GameVersion { get; set; }
        public DateTime GameVersionReleaseDate { get; set; }
        public string GameVersionName { get; set; }
    }
}
