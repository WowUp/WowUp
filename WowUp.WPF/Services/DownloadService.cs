using Flurl.Http;
using System;
using System.IO;
using System.IO.Compression;
using System.Threading.Tasks;
using WowUp.WPF.Services.Contracts;

namespace WowUp.WPF.Services
{
    public class DownloadService : IDownloadSevice
    {
        public async Task<string> DownloadFile(string downloadUrl, string outputFolder)
        {
            return await downloadUrl.DownloadFileAsync(outputFolder);
        }

        public Task<string> UnzipFile(string inputFilePath)
        {
            var zipFileDirectory = Path.GetDirectoryName(inputFilePath);
            var tempZipDirectory = Path.Combine(zipFileDirectory, Guid.NewGuid().ToString());

            Directory.CreateDirectory(tempZipDirectory);

            using (var fileStream = File.OpenRead(inputFilePath))
            {
                var archive = new ZipArchive(fileStream);
                archive.ExtractToDirectory(tempZipDirectory);
            }

            if (!Directory.Exists(tempZipDirectory))
            {
                throw new FileNotFoundException("Unzipped addon folder not found");
            }

            return  Task.FromResult(tempZipDirectory);
        }

        public Task ZipFile(string inputDirectory, string outputFilePath)
        {
            throw new NotImplementedException();
        }
    }
}
