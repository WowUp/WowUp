using CommandLine;
using Serilog;
using System;
using System.IO;
using WowUp.Updater.Models;
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

            try
            {
                Log.Information("Checking Origin");
                if (!File.Exists(opts.Origin))
                {
                    throw new Exception($"Origin exe not found: {opts.Origin}");
                }

                Log.Information("Checking Update");
                if (!File.Exists(opts.Update))
                {
                    throw new Exception($"Update exe not found: {opts.Update}");
                }
         
                Log.Information($"Backing up original exe {opts.Origin} => {backupPath}");
                File.Move(opts.Origin, backupPath);

                Log.Information($"Moving update exe {opts.Update} => {opts.Origin}");
                File.Move(opts.Update, opts.Origin);
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

            Log.Information("Update complete");
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
