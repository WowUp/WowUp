using System;
using System.Collections.Generic;
using System.Threading.Tasks;
using WowUp.Common.Enums;
using WowUp.Common.Models;
using WowUp.WPF.Entities;
using WowUp.WPF.Models.Events;

namespace WowUp.WPF.Services.Contracts
{
    public delegate void AddonEventHandler(object sender, AddonEventArgs e);

    public interface IAddonService
    {
        event AddonEventHandler AddonUninstalled;
        event AddonEventHandler AddonInstalled;
        event AddonEventHandler AddonUpdated;

        string BackupPath { get; }

        Addon GetAddon(int addonId);
        Addon UpdateAddon(Addon addon);

        Task<List<PotentialAddon>> Search(
            string query, 
            WowClientType clientType);

        bool IsInstalled(
            string externalId, 
            WowClientType clientType);

        Task<List<PotentialAddon>> GetFeaturedAddons(WowClientType clientType);

        Task<PotentialAddon> GetAddonByUri(
            Uri addonUri,
            WowClientType clientType,
            Action<AddonInstallState, decimal> onUpdate = null);

        Task InstallAddon(
            PotentialAddon addon,
            WowClientType clientType,
            Action<AddonInstallState, decimal> onUpdate = null);

        Task InstallAddon(
            int addonId, 
            Action<AddonInstallState, decimal> onUpdate);

        Task UninstallAddon(Addon addon);

        Task<List<Addon>> GetAddons(
            WowClientType clientType, 
            bool rescan = false);
    }
}
