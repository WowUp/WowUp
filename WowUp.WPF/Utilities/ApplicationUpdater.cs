using Serilog;
using System;
using System.Collections.Generic;
using System.IO;
using System.Threading.Tasks;
using WowUp.Common.Enums;
using WowUp.Common.Models.Events;
using WowUp.Common.Services.Contracts;
using WowUp.WPF.Services.Contracts;

namespace WowUp.WPF.Utilities
{
    public class ApplicationUpdater
    {
        private readonly IDownloadService _downloadService;
        private readonly List<string> _cleanupFiles;

        public static string UpdateFilePath => Path.Combine(FileUtilities.DownloadPath, AppUtilities.ApplicationFileName);
        public static bool UpdateFileExists => File.Exists(UpdateFilePath);

        public string LatestVersionUrl { get; set; }

        private ApplicationUpdateState _state;
        public ApplicationUpdateState State
        {
            get => _state;
            set
            {
                _state = value;
                NotifyChanges();
            }
        }

        private decimal _currentProgress;
        public decimal CurrentProgress
        {
            get => _currentProgress;
            private set
            {
                _currentProgress = value;
                NotifyChanges();
            }
        }

        public event WowUpUpdateEventHandler UpdateChanged;

        private string _downloadedZipPath;
        private string _unpackedPath;

        public ApplicationUpdater(
            IDownloadService downloadService)
        {
            _downloadService = downloadService;

            _cleanupFiles = new List<string>();
            _downloadedZipPath = string.Empty;
            _unpackedPath = string.Empty;

            State = ApplicationUpdateState.Pending;
            CurrentProgress = 0.0m;
        }

        public static void ProcessUpdateFile()
        {
            if (!UpdateFileExists)
            {
                return;
            }

            var destination = AppUtilities.ApplicationFilePath;
            var backupPath = Path.Combine(Path.GetDirectoryName(destination), Path.GetFileName(destination) + ".bak");

            // move the current exe to a .exe.bak file
            File.Move(destination, backupPath);

            // move the pending wowup.exe to the current location
            File.Move(UpdateFilePath, destination);

            AppUtilities.RestartApplication();
        }

        public async Task Update()
        {
            try
            {
                SetNewState(ApplicationUpdateState.Downloading);
                await DownloadUpdate();

                SetNewState(ApplicationUpdateState.Unpacking);
                await UnpackUpdate();

                SetNewState(ApplicationUpdateState.Complete);
            }
            catch (Exception ex)
            {
                Log.Error(ex, "Failed to update application");
            }
            finally
            {
                await Dispose();
            }
        }

        private async Task Dispose()
        {
            foreach (var file in _cleanupFiles)
            {
                if (Directory.Exists(file))
                {
                    await FileUtilities.DeleteDirectory(file);
                }
                else
                {
                    File.Delete(file);
                }
            }

            _cleanupFiles.Clear();
        }

        private void SetNewState(ApplicationUpdateState state)
        {
            _currentProgress = 0.0m;
            State = state;
        }

        private void NotifyChanges()
        {
            UpdateChanged?.Invoke(this, new WowUpUpdateEventArgs(State, CurrentProgress));
        }

        private async Task UnpackUpdate()
        {
            _unpackedPath = await _downloadService.UnzipFile(_downloadedZipPath);
            _cleanupFiles.Add(_unpackedPath);

            MoveUnpackedExe();
        }

        private async Task DownloadUpdate()
        {
            _downloadedZipPath = await _downloadService.DownloadZipFile(
                LatestVersionUrl,
                FileUtilities.DownloadPath,
                (progress) =>
                {
                    CurrentProgress = progress;
                });

            _cleanupFiles.Add(_downloadedZipPath);
        }

        private void MoveUnpackedExe()
        {
            var fileName = AppUtilities.ApplicationFileName;

            var unpackedFile = Path.Combine(_unpackedPath, fileName);
            if (!File.Exists(unpackedFile))
            {
                throw new Exception($"Unpacked {fileName} not found");
            }

            var destination = Path.Combine(FileUtilities.DownloadPath, fileName);
            if (File.Exists(destination))
            {
                File.Delete(destination);
            }

            // copy the unzipped wowup.exe to the pending location
            File.Move(unpackedFile, destination);
        }

        private void BackupExecutable()
        {
            var assemblyLocation = FileUtilities.ExecutablePath;
            var fileName = Path.GetFileNameWithoutExtension(assemblyLocation);
            var fileDir = Path.GetDirectoryName(assemblyLocation);
            File.Move(assemblyLocation, Path.Combine(fileDir, $"{fileName}.bak"), true);
        }
    }
}
