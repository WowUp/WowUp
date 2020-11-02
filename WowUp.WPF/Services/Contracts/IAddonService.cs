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
    public delegate void AddonStateEventHandler(object sender, AddonStateEventArgs e);
    public delegate void AddonListUpdatedEventHandler(object sender, EventArgs e);

    public interface IAddonService
    {
        event AddonEventHandler AddonUninstalled;
        event AddonEventHandler AddonInstalled;
        event AddonEventHandler AddonUpdated;
        event AddonStateEventHandler AddonStateChanged;
        event AddonListUpdatedEventHandler AddonListUpdated;

        string BackupPath { get; }

        string GetFullInstallPath(Addon addon);

        Addon GetAddon(int addonId);
        Addon UpdateAddon(Addon addon);

        Task<List<PotentialAddon>> Search(
            string query,
            WowClientType clientType,
            Action<Exception> onProviderError);

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
            Action<AddonInstallState, decimal> onUpdate = null);

        Task UninstallAddon(Addon addon, bool uninstallDependencies);

        Task<List<Addon>> GetAddons(
            WowClientType clientType,
            bool rescan = false);

        Task<int> ProcessAutoUpdates();

        int GetAddonCount(WowClientType clientType);

        // Dependencies
        IEnumerable<AddonDependency> GetDependencies(Addon addon);

        bool HasDependencies(Addon addon);

        int GetDependencyCount(Addon addon);
    }
}
