using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using WowUp.Entities;
using WowUp.Models;
using WowUp.Services;
using Xamarin.Forms;

[assembly: Dependency(typeof(WowUp.GTK.Services.AddonService))]
namespace WowUp.GTK.Services
{
    public class AddonService : IAddonService
    {
        public string DownloadPath => throw new NotImplementedException();

        public string BackupPath => throw new NotImplementedException();

        public Addon GetAddon(int addonId)
        {
            throw new NotImplementedException();
        }

        public Task<List<Addon>> GetAddons(WowClientType clientType, bool rescan = false)
        {
            throw new NotImplementedException();
        }

        public Task InstallAddon(int addonId, Action<AddonInstallState, decimal> onUpdate)
        {
            throw new NotImplementedException();
        }
    }
}
