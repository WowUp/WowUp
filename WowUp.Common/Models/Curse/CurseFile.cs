using System;
using System.Collections.Generic;

namespace WowUp.Common.Models.Curse
{
    public class CurseFile
    {
        public int Id { get; set; }
        public string DisplayName { get; set; }
        public string FileName { get; set; }
        public DateTime FileDate { get; set; }
        public long FileLength { get; set; }
        public CurseReleaseType ReleaseType { get; set; }
        public int FileStatus { get; set; }
        public string DownloadUrl { get; set; }
        public bool IsAlternate { get; set; }
        public int AlternateFileId { get; set; }
        public bool IsAvailable { get; set; }
        public IEnumerable<CurseDependency> Dependencies { get; set; }
        public IEnumerable<CurseModule> Modules { get; set; }
        public long PackageFingerprint { get; set; }
        public IEnumerable<string> GameVersion { get; set; }
        public IEnumerable<CurseSortableGameVersion> SortableGameVersion { get; set; }
        public object InstallMetadata { get; set; }
        public object Changelog { get; set; }
        public bool HasInstallScript { get; set; }
        public bool IsCompatibleWithClient { get; set; }
        public int CategorySectionPackageType { get; set; }
        public int RestrictProjectFileAccess { get; set; }
        public int ProjectStatus { get; set; }
        public long? RenderCacheId { get; set; }
        public object FileLegacyMappingId { get; set; }
        public int ProjectId { get; set; }
        public int? ParentProjectFileId { get; set; }
        public object ParentFileLegacyMappingId { get; set; }
        public int? FileTypeId { get; set; }
        public object ExposeAsAlternative { get; set; }
        public long PackageFingerprintId { get; set; }
        public DateTime? GameVersionDateReleased { get; set; }
        public long? GameVersionMappingId { get; set; }
        public int? GameVersionId { get; set; }
        public int GameId { get; set; }
        public bool IsServerPack { get; set; }
        public int? ServerPackFileId { get; set; }
        public string GameVersionFlavor { get; set; }
    }
}
