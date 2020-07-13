using Flurl.Http;
using System;
using System.IO;
using System.IO.Compression;
using System.Net;
using System.Threading.Tasks;
using WowUp.Common.Services.Contracts;

namespace WowUp.WPF.Services
{
    public class DownloadService : IDownloadService
    {
        public async Task<string> DownloadFile(
            string downloadUrl, 
            string outputFolder, 
            Action<int> progressAction = null)
        {
            WebClient client = new WebClient();
            Uri uri = new Uri(downloadUrl);
            var fileName = Path.GetFileName(downloadUrl);
            var downloadFilePath = Path.Join(outputFolder, fileName);

            client.DownloadProgressChanged += (sender, e) =>
            {
                progressAction?.Invoke(e.ProgressPercentage);
            };

            await client.DownloadFileTaskAsync(uri, downloadFilePath);

            return downloadFilePath;
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
