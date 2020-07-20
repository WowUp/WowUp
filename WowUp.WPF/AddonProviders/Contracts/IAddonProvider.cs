using System;
using System.Collections.Generic;
using System.Threading.Tasks;
using WowUp.Common.Enums;
using WowUp.Common.Models.Addons;
using WowUp.WPF.Models;

namespace WowUp.WPF.AddonProviders.Contracts
{
    public interface IAddonProvider
    {
        string Name { get; }

        Task<IList<PotentialAddon>> GetFeaturedAddons(WowClientType clientType);

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

        Task<AddonSearchResult> Search(
            Uri addonUri, 
            WowClientType clientType);

        bool IsValidAddonUri(Uri addonUri);
    }
}
