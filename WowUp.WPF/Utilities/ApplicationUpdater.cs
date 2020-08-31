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

        public async Task Update()
        {
            try
            {
                SetNewState(ApplicationUpdateState.Downloading);
                await DownloadUpdate();

                SetNewState(ApplicationUpdateState.CreateBackup);
                BackupExecutable();

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
            var assemblyLocation = FileUtilities.ExecutablePath;
            var fileName = Path.GetFileName(assemblyLocation);

            var unpackedFile = Path.Combine(_unpackedPath, fileName);
            if (!File.Exists(unpackedFile))
            {
                throw new Exception($"Unpacked {fileName} not found");
            }

            File.Move(unpackedFile, assemblyLocation);
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
