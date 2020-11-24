using SQLite;
using System;
using System.Collections.Generic;
using WowUp.Common.Enums;

namespace WowUp.WPF.Entities
{
    [Table("Addons")]
    public class Addon : BaseEntity
    {
        private int _id;
        [PrimaryKey, AutoIncrement]
        public int Id
        {
            get => _id;
            set { SetProperty(ref _id, value); }
        }

        private string _name;
        [NotNull]
        public string Name
        {
            get => _name;
            set { SetProperty(ref _name, value); }
        }

        private string _folderName;
        [NotNull]
        public string FolderName
        {
            get => _folderName;
            set { SetProperty(ref _folderName, value); }
        }

        private string _downloadUrl;
        public string DownloadUrl
        {
            get => _downloadUrl;
            set { SetProperty(ref _downloadUrl, value); }
        }

        private string _installedVersion;
        public string InstalledVersion
        {
            get => _installedVersion;
            set { SetProperty(ref _installedVersion, value); }
        }

        private string _latestVersion;
        public string LatestVersion
        {
            get => _latestVersion;
            set { SetProperty(ref _latestVersion, value); }
        }

        private string _installBackup;
        public string InstallBackup
        {
            get => _installBackup;
            set { SetProperty(ref _installBackup, value); }
        }

        private DateTime _installedAt;
        public DateTime InstalledAt
        {
            get => _installedAt;
            set { SetProperty(ref _installedAt, value); }
        }

        private string _externalId;
        public string ExternalId
        {
            get => _externalId;
            set { SetProperty(ref _externalId, value); }
        }

        private string _providerName;
        public string ProviderName
        {
            get => _providerName;
            set { SetProperty(ref _providerName, value); }
        }

        private string _externalUrl;
        public string ExternalUrl
        {
            get => _externalUrl;
            set { SetProperty(ref _externalUrl, value); }
        }

        private string _thumbnailUrl;
        public string ThumbnailUrl
        {
            get => _thumbnailUrl;
            set { SetProperty(ref _thumbnailUrl, value); }
        }

        private string _gameVersion;
        public string GameVersion
        {
            get => _gameVersion;
            set { SetProperty(ref _gameVersion, value); }
        }

        private string _author;
        public string Author
        {
            get => _author;
            set { SetProperty(ref _author, value); }
        }

        private string _installedFolders;
        public string InstalledFolders
        {
            get => _installedFolders;
            set { SetProperty(ref _installedFolders, value); }
        }

        private bool _isIgnored;
        public bool IsIgnored
        {
            get => _isIgnored;
            set { SetProperty(ref _isIgnored, value); }
        }

        private bool _autoUpdateEnabled = false;
        public bool AutoUpdateEnabled
        {
            get => _autoUpdateEnabled;
            set { SetProperty(ref _autoUpdateEnabled, value); }
        }

        private WowClientType _clientType;
        [NotNull]
        public WowClientType ClientType
        {
            get => _clientType;
            set { SetProperty(ref _clientType, value); }
        }

        private AddonChannelType _channelType = AddonChannelType.Stable;
        public AddonChannelType ChannelType
        {
            get => _channelType;
            set { SetProperty(ref _channelType, value); }
        }

        private DateTime _updatedAt;
        public DateTime UpdatedAt
        {
            get => _updatedAt;
            set { SetProperty(ref _updatedAt, value); }
        }

        [Ignore]
        public IEnumerable<Addon> Dependencies { get; set; }
    }
}
