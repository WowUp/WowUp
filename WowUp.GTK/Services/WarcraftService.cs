using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using WowUp.Models;
using WowUp.Services;
using Xamarin.Forms;

[assembly: Dependency(typeof(WowUp.GTK.Services.WarcraftService))]
namespace WowUp.GTK.Services
{
    public class WarcraftService : IWarcraftService
    {
        public Task<string> GetAddonDirectory(WowClientType clientType)
        {
            throw new NotImplementedException();
        }

        public Task<string> GetClassicAddonFolderPath()
        {
            throw new NotImplementedException();
        }

        public Task<string> GetClassicFolderPath()
        {
            return Task.FromResult(string.Empty);
        }

        public Task<string> GetRetailAddonFolderPath()
        {
            throw new NotImplementedException();
        }

        public Task<string> GetRetailFolderPath()
        {
            return Task.FromResult(string.Empty);
        }

        public Task<string> GetWowFolderPath()
        {
            return Task.FromResult(string.Empty);
        }

        public Task<IEnumerable<AddonFolder>> ListClassicAddons(bool forceReload = false)
        {
            throw new NotImplementedException();
        }

        public Task<IEnumerable<AddonFolder>> ListRetailAddons(bool forceReload = false)
        {
            throw new NotImplementedException();
        }

        public Task<string> SelectWowFolder()
        {
            throw new NotImplementedException();
        }
    }
}
