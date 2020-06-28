using System.Threading.Tasks;

namespace WowUp.Services
{
    public interface IDownloadSevice
    {
        Task<string> DownloadFile(string downloadUrl, string outputFolder);

        Task ZipFile(string inputDirectory, string outputFilePath);

        Task UnzipFile(string inputFilePath, string outputFolder);
    }
}
