using System;
using System.Collections.Generic;

namespace WowUp.Models.Curse
{
    public class CurseSearchResult
    {
        public int Id { get; set; }

        public string Name { get; set; }

        public IEnumerable<CurseAuthor> Authors { get; set; }

        public IEnumerable<CurseAttachment> Attachments { get; set; }

        public string WebsiteUrl { get; set; }
        public int GameId { get; set; }
        public int DefaultFileId { get; set; }
        public decimal DownloadCount { get; set; }
        public IEnumerable<CurseFile> LatestFiles { get; set; }
        public IEnumerable<CurseCategory> Catagories { get; set; }
        public int Status { get; set; }
        public int PrimaryCategoryId { get; set; }
        public CurseCategorySection CategorySection { get; set; }
        public string Slug { get; set; }

        public IEnumerable<CurseGameVersionLatestFile> GameVersionLatestFiles { get; set; }

        public bool IsFeatured { get; set; }
        public decimal PopularityScore { get; set; }
        public int GamePopularityRank { get; set; }
        public string PrimaryLanguage { get; set; }
        public string GameSlug { get; set; }
        public string GameName { get; set; }
        public string PortalName { get; set; }
        public DateTime DateModified { get; set; }
        public DateTime DateCreated { get; set; }
        public DateTime DateReleased { get; set; }
        public bool IsAvailable { get; set; }
        public bool IsExperiemental { get; set; }
    }
}
