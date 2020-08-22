using System.Collections.Generic;
using System.IO;
using System.Linq;

namespace WowUp.WPF.AddonProviders.Curse
{
    public class CurseAddonScanner
    {
        private DirectoryInfo _addonDirectoryInfo;

        public List<CurseFolderScanner> AddonFolders { get; private set; }

        public CurseAddonScanner(string addonDirectoryPath)
        {
            _addonDirectoryInfo = new DirectoryInfo(addonDirectoryPath);

        }

        public CurseAddonScanner Scan()
        {
            var addonDirectories = _addonDirectoryInfo.GetDirectories();

            AddonFolders = addonDirectories.Select(dir => new CurseFolderScanner(dir)).ToList();

            var fingerprints = AddonFolders.Select(af => af.Fingerprint);
            var str = string.Join(",\n", fingerprints);
            return this;
        }

        
    }
}
