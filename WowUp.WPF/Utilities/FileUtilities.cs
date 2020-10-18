using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.IO;
using System.Linq;
using System.Security;
using System.Security.Permissions;
using System.Threading.Tasks;

namespace WowUp.WPF.Utilities
{
    public static class FileUtilities
    {
        private static readonly string LocalAppDataPath = Environment
            .GetFolderPath(Environment.SpecialFolder.LocalApplicationData);

        public static readonly string AppDataPath = Path.Combine(LocalAppDataPath, "WowUp");
        public static readonly string AppLogsPath = Path.Combine(AppDataPath, "Logs");
        public static readonly string DownloadPath = Path.Combine(AppDataPath, "Downloads");
        public static readonly string CachePath = Path.Combine(AppDataPath, "Cache");
        public static readonly string ThumbnailCachePath = Path.Combine(CachePath, "Thumbnails");
        public static readonly string ExecutablePath = Process.GetCurrentProcess().MainModule.FileName;
        public static readonly string UpdaterPath = Path.Combine(Path.GetDirectoryName(Process.GetCurrentProcess().MainModule.FileName), "WowUpUpdater.exe");

        static FileUtilities()
        {
            if (!Directory.Exists(AppDataPath))
            {
                Directory.CreateDirectory(AppDataPath);
            }

            if (!Directory.Exists(DownloadPath))
            {
                Directory.CreateDirectory(DownloadPath);
            }

            if (!Directory.Exists(ThumbnailCachePath))
            {
                Directory.CreateDirectory(ThumbnailCachePath);
            }
        }

        public static bool HasWriteAccess(string path)
        {
            var dir = Path.GetDirectoryName(path);
            var testPath = Path.Combine(dir, $"{Guid.NewGuid()}.txt");

            try
            {
                File.WriteAllText(testPath, string.Empty);
                return true;
            }
            catch(Exception)
            {
                return false;
            }
            finally
            {
                if (File.Exists(testPath))
                {
                    File.Delete(testPath);
                }
            }
        }

        public static void CopyFile(string sourcePath, string destinationPath, bool overwrite)
        {
            File.Copy(sourcePath, destinationPath, overwrite);
        }

        public static FileVersionInfo GetFileVersion(string filePath)
        {
            return FileVersionInfo.GetVersionInfo(filePath);
        }

        public static MemoryStream GetMemoryStreamFromFile(string filePath)
        {
            return new MemoryStream(File.ReadAllBytes(filePath));
        }

        public static async Task<MemoryStream> GetMemoryStreamFromFileAsync(string filePath)
        {
            var fileData = await File.ReadAllBytesAsync(filePath);
            return new MemoryStream(fileData);
        }

        public static async Task<string> GetFileTextAsync(string filePath)
        {
            using var reader = File.OpenText(filePath);
            return await reader.ReadToEndAsync();
        }

        public static async Task DeleteDirectory(string filePath)
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

        public static IEnumerable<string> GetAllDriveLetters()
        {
            return GetAllDrives().Select(drive => drive.Name);
        }

        public static IEnumerable<DriveInfo> GetAllDrives()
        {
            return DriveInfo.GetDrives();
        }

        public static IEnumerable<string> GetDirectoryNames(string baseDir)
        {
            var directoryPaths = Directory.GetDirectories(baseDir);
            return directoryPaths.Select(path => Path.GetFileName(path));
        }

        public static IEnumerable<FileInfo> GetFiles(string directoryPath, string searchPattern = null)
        {
            return new DirectoryInfo(directoryPath).GetFiles(searchPattern);
        }

        public static void DirectoryCopy(string sourceDirName, string destDirName, bool copySubDirs = true)
        {
            // Get the subdirectories for the specified directory.
            DirectoryInfo dir = new DirectoryInfo(sourceDirName);

            if (!dir.Exists)
            {
                throw new DirectoryNotFoundException(
                    "Source directory does not exist or could not be found: "
                    + sourceDirName);
            }

            DirectoryInfo[] dirs = dir.GetDirectories();
            // If the destination directory doesn't exist, create it.
            if (!Directory.Exists(destDirName))
            {
                Directory.CreateDirectory(destDirName);
            }

            // Get the files in the directory and copy them to the new location.
            FileInfo[] files = dir.GetFiles();
            foreach (FileInfo file in files)
            {
                string temppath = Path.Combine(destDirName, file.Name);
                file.CopyTo(temppath, true);
            }

            // If copying subdirectories, copy them and their contents to new location.
            if (copySubDirs)
            {
                foreach (DirectoryInfo subdir in dirs)
                {
                    string temppath = Path.Combine(destDirName, subdir.Name);
                    DirectoryCopy(subdir.FullName, temppath, copySubDirs);
                }
            }
        }
    }
}
