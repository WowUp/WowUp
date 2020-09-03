using CommandLine;
using Serilog;
using System;
using System.Diagnostics;
using System.IO;
using WowUp.Updater.Models;
using WowUp.Updater.Utilities;
using WowUp.Utilities;

namespace WowUp.Updater
{
    class Program
    {
        static void Main(string[] args)
        {
            var logFilePath = Path.Combine(FileUtilities.AppLogsPath, "wowup-updater-logs.txt");

            Log.Logger = new LoggerConfiguration()
                .MinimumLevel.Debug()
                .WriteTo.File(logFilePath, rollingInterval: RollingInterval.Day, retainedFileCountLimit: 7)
                .CreateLogger();

            Log.Information($"Starting Update");

            Parser.Default.ParseArguments<Options>(args).WithParsed(opts => ProcessUpdate(opts));
        }

        private static void ProcessUpdate(Options opts)
        {
            var backupPath = GetBackupPath(opts.Origin);
            var unzippedPath = string.Empty;

            try
            {
                WaitForWowUpToEnd(opts.ProcessName);

                Log.Information("Checking Origin");
                ValidateOrigin(opts.Origin);

                Log.Information("Checking Update");
                ValidateUpdate(opts.Update);

                Log.Information("Unzipping update");
                unzippedPath = ZipUtilities.UnzipFile(opts.Update);
         
                Log.Information($"Backing up original exe {opts.Origin} => {backupPath}");
                FileUtilities.TryMove(opts.Origin, backupPath, true);

                FileUtilities.Move(unzippedPath, Path.GetDirectoryName(opts.Origin));

                Log.Information("Deleting update zip");
                File.Delete(opts.Update);

                Log.Information("Update complete");
                Process.Start(opts.Origin);
            }
            catch (Exception ex)
            {
                Log.Error(ex, $"Failed to update app.");

                //Check if we made the backup and revert
                if (!File.Exists(opts.Origin) && File.Exists(backupPath))
                {
                    Log.Information("Attempting to rollback changes");
                    File.Move(backupPath, opts.Origin);
                }

                throw;
            }
            finally
            {
                if (Directory.Exists(unzippedPath))
                {
                    Directory.Delete(unzippedPath, true);
                }
            }
        }

        private static void WaitForWowUpToEnd(string processName)
        {
            Log.Information($"Waiting for {processName} to exit");
            var processes = Process.GetProcessesByName(processName);
            foreach(var process in processes)
            {
                var exited = process.WaitForExit(5000);
                if (!exited)
                {
                    throw new Exception("WowUp did not exit");
                }
            }
        }

        private static void ValidateUpdate(string updatePath)
        {
            if (!File.Exists(updatePath))
            {
                throw new Exception($"Update file not found: {updatePath}");
            }

            if (!Path.GetExtension(updatePath).Equals(".zip", StringComparison.OrdinalIgnoreCase))
            {
                throw new Exception("Invalid update path, must be a zip file");
            }
        }

        private static void ValidateOrigin(string originPath)
        {
            if (!File.Exists(originPath))
            {
                throw new Exception($"Origin file not found: {originPath}");
            }

            if (!Path.GetExtension(originPath).Equals(".exe", StringComparison.OrdinalIgnoreCase))
            {
                throw new Exception("Invalid origin path, must be an exe file");
            }
        }

        private static string GetBackupPath(string exePath)
        {
            var fileName = Path.GetFileName(exePath);
            var dirName = Path.GetDirectoryName(exePath);
            var backupName = $"{fileName}.bak";

            return Path.Combine(dirName, backupName);
        }
    }
}
