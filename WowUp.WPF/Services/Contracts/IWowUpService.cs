using System;
using System.Threading.Tasks;
using WowUp.WPF.Models;

namespace WowUp.WPF.Services.Contracts
{
    public interface IWowUpService
    {
        void ShowLogsFolder();

        Task<bool> IsUpdateAvailable();
        Task<string> GetLatestVersion();
        Task<string> GetLatestVersionUrl();
        Task<ChangeLogFile> GetChangeLogFile();
    }
}
