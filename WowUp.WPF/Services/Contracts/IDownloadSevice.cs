using System.Threading.Tasks;

namespace WowUp.WPF.Services.Contracts
{
    public interface IDownloadSevice
    {
        Task<string> DownloadFile(string downloadUrl, string outputFolder);

        Task ZipFile(string inputDirectory, string outputFilePath);

        Task<string> UnzipFile(string inputFilePath);
    }
}
