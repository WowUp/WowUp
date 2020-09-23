using Serilog;
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
        public async Task DownloadFile(
            string downloadUrl,
            string outputPath)
        {
            WebClient client = new WebClient();
            Uri uri = new Uri(downloadUrl);

            await client.DownloadFileTaskAsync(uri, outputPath);
        }

        public async Task<string> DownloadZipFile(
            string downloadUrl,
            string outputFolder,
            Action<int> progressAction = null)
        {
            Log.Information($"Downloading Zip File: {downloadUrl}");
            WebClient client = new WebClient();
            Uri uri = new Uri(downloadUrl);
            var fileName = Path.GetFileName(downloadUrl);
            var fileExtension = Path.GetExtension(fileName);
            if (fileExtension != ".zip")
            {
                fileName = $"{Guid.NewGuid()}.zip";
            }

            var downloadFilePath = Path.Join(outputFolder, fileName);

            client.DownloadProgressChanged += (sender, e) =>
            {
                progressAction?.Invoke(e.ProgressPercentage);
            };

            await client.DownloadFileTaskAsync(uri, downloadFilePath);

            return downloadFilePath;
        }

        public async Task<string> UnzipFile(string inputFilePath)
        {
            return await Task.Run(() =>
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

                return tempZipDirectory;
            });

            //return Task.FromResult(tempZipDirectory);
        }

        public Task ZipFile(string inputDirectory, string outputFilePath)
        {
            throw new NotImplementedException();
        }
    }
}
