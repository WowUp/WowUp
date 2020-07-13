using System;
using System.Threading.Tasks;

namespace WowUp.Common.Services.Contracts
{
    public interface IDownloadService
    {
        Task<string> DownloadFile(string downloadUrl, string outputFolder, Action<int> progressAction = null);

        Task ZipFile(string inputDirectory, string outputFilePath);

        Task<string> UnzipFile(string inputFilePath);
    }
}
