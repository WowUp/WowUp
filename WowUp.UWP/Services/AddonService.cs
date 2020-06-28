using System.IO;
using Windows.Storage;
using WowUp.Services;
using Xamarin.Forms;

[assembly: Dependency(typeof(WowUp.UWP.Services.AddonService))]
namespace WowUp.UWP.Services
{
    public class AddonService : BaseAddonService
    {
        public override string BackupPath => Path.Combine(ApplicationData.Current.LocalFolder.Path, BackupFolder);
        public override string DownloadPath => Path.Combine(ApplicationData.Current.LocalFolder.Path, DownloadFolder);
    }
}
