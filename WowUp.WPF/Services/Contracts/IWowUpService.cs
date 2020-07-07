using System;
using System.Threading.Tasks;
using WowUp.WPF.Models;

namespace WowUp.WPF.Services.Contracts
{
    public interface IWowUpService
    {
        void ShowLogsFolder();

        Version CurrentVersion { get; }
        string CurrentVersionString { get; }

        Task<bool> IsUpdateAvailable();
        Task<string> GetLatestVersion();
        Task<string> GetLatestVersionUrl();
        Task<ChangeLogFile> GetChangeLogFile();
    }
}
