using Flurl.Http;
using System;
using System.IO;
using System.IO.Compression;
using System.Threading.Tasks;
using Windows.Storage;
using WowUp.Services;
using Xamarin.Forms;

[assembly: Dependency(typeof(WowUp.UWP.Services.DownloadService_UWP))]
namespace WowUp.UWP.Services
{
    public class DownloadService_UWP : IDownloadSevice
    {
        public async Task<string> DownloadFile(string downloadUrl, string outputFolder)
        {
            return await downloadUrl.DownloadFileAsync(outputFolder);
        }

        public async Task UnzipFile(string inputFilePath, string outputFolder)
        {
            var zipFileDirecotry = Path.GetDirectoryName(inputFilePath);
            var tempZipDirectory = Path.Combine(zipFileDirecotry, Guid.NewGuid().ToString());

            Directory.CreateDirectory(tempZipDirectory);

            var tempZipStorageFolder = await StorageFolder.GetFolderFromPathAsync(tempZipDirectory);
            var outputStorageFolder = await StorageFolder.GetFolderFromPathAsync(outputFolder);

            using (var fileStream = File.OpenRead(inputFilePath))
            {
                var archive = new ZipArchive(fileStream);
                archive.ExtractToDirectory(tempZipDirectory);
            }

            if (!Directory.Exists(tempZipDirectory))
            {
                throw new FileNotFoundException("Unzipped addon folder not found");
            }

            var unzippedFolders = await tempZipStorageFolder.GetFoldersAsync();
            foreach (var unzippedFolder in unzippedFolders)
            {
                await CopyFolderAsync(unzippedFolder, outputStorageFolder);
            }

            await DeleteDirectory(tempZipDirectory);
        }

        public async Task DeleteDirectory(string filePath)
        {
            if (Directory.Exists(filePath))
            {
                Directory.Delete(filePath, true);
            }

            var attempts = 0;
            while (Directory.Exists(filePath))
            {
                if (attempts >= 10)
                {
                    throw new Exception("Failed to delete directory");
                }

                attempts += 1;
                await Task.Delay(100);
            }
        }

        public Task ZipFile(string inputDirectory, string outputFilePath)
        {
            System.IO.Compression.ZipFile.CreateFromDirectory(inputDirectory, outputFilePath);

            return Task.CompletedTask;
        }

        public async Task CopyFolderAsync(StorageFolder source, StorageFolder destinationContainer, string desiredName = null)
        {
            StorageFolder destinationFolder = await destinationContainer
                .CreateFolderAsync(desiredName ?? source.Name, CreationCollisionOption.ReplaceExisting);

            foreach (var file in await source.GetFilesAsync())
            {
                await file.CopyAsync(destinationFolder, file.Name, NameCollisionOption.ReplaceExisting);
            }
            foreach (var folder in await source.GetFoldersAsync())
            {
                await CopyFolderAsync(folder, destinationFolder);
            }
        }
    }
}
