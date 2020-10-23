using System;
using System.Collections.Generic;
using System.Threading.Tasks;
using WowUp.Common.Enums;
using WowUp.Common.Models;
using WowUp.Common.Models.Addons;
using WowUp.WPF.Entities;
using WowUp.WPF.Models.WowUp;

namespace WowUp.WPF.AddonProviders.Contracts
{
    public interface IAddonProvider
    {
        string Name { get; }

        Task<IList<PotentialAddon>> GetFeaturedAddons(WowClientType clientType);

        Task<IEnumerable<PotentialAddon>> Search(
            string query,
            WowClientType clientType);

        Task<PotentialAddon> Search(
            Uri addonUri,
            WowClientType clientType);

        Task<PotentialAddon> Search(
            Uri addonUri,
            string addonName,
            WowClientType clientType);

        Task<IList<AddonSearchResult>> GetAll(
            WowClientType clientType,
            IEnumerable<string> addonIds);

        Task<IEnumerable<AddonSearchResult>> Search(
            string addonName,
            string folderName,
            WowClientType clientType,
            string nameOverride = null);

        Task<AddonSearchResult> GetById(
            string addonId,
            WowClientType clientType);

        bool IsValidAddonUri(Uri addonUri);

        void OnPostInstall(Addon addon);

        Task Scan(
            WowClientType clientType,
            AddonChannelType addonChannelType, 
            IEnumerable<AddonFolder> addonFolders);
    }
}
