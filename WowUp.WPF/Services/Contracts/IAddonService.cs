using System;
using System.Collections.Generic;
using System.Threading.Tasks;
using WowUp.WPF.Entities;
using WowUp.WPF.Models;

namespace WowUp.WPF.Services.Contracts
{
    public interface IAddonService
    {
        string DownloadPath { get; }
        string BackupPath { get; }

        Addon GetAddon(int addonId);

        Task InstallAddon(int addonId, Action<AddonInstallState, decimal> onUpdate);

        Task<List<Addon>> GetAddons(WowClientType clientType, bool rescan = false);
    }
}
