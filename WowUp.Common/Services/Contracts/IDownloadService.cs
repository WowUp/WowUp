using System;
using System.Threading.Tasks;

namespace WowUp.Common.Services.Contracts
{
    public interface IDownloadService
    {
        Task DownloadFile(string downloadUrl, string outputPath);

        Task<string> DownloadZipFile(string downloadUrl, string outputFolder, Action<int> progressAction = null);

        Task ZipFile(string inputDirectory, string outputFilePath);

        Task<string> UnzipFile(string inputFilePath);
    }
}
