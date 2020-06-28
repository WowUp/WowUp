using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using Windows.Storage;
using Windows.Storage.AccessCache;

namespace WowUp.UWP.Services
{
    public static class UwpFileService
    {
        public static string GetFileToken(string mruKey)
        {
            var mru = StorageApplicationPermissions.MostRecentlyUsedList;
            var entry = mru.Entries.FirstOrDefault(e => e.Metadata == mruKey);

            return entry.Token;
        }

        public static async Task<IStorageItem> GetFile(string mruKey)
        {
            var mru = StorageApplicationPermissions.MostRecentlyUsedList;
            var mruToken = GetFileToken(mruKey);
            var item = await mru.GetItemAsync(mruToken);

            return item;
        }

        public static async Task<StorageFolder> GetFolder(string mruKey)
        {
            var mru = StorageApplicationPermissions.MostRecentlyUsedList;
            var mruToken = GetFileToken(mruKey);
            if (string.IsNullOrEmpty(mruToken))
            {
                return null;
            }

            var item = await mru.GetItemAsync(mruToken);

            return (StorageFolder)item;
        }

        public static async Task<IStorageItem> SelectFile(IEnumerable<string> allowedExtensions, string mruKey = null)
        {
            var picker = new Windows.Storage.Pickers.FileOpenPicker
            {
                ViewMode = Windows.Storage.Pickers.PickerViewMode.List,
                SuggestedStartLocation = Windows.Storage.Pickers.PickerLocationId.ComputerFolder
            };

            foreach (var ext in allowedExtensions)
            {
                picker.FileTypeFilter.Add(ext);
            }

            StorageFile file = await picker.PickSingleFileAsync();
            if (file == null)
            {
                return null;
            }

            if (!string.IsNullOrEmpty(mruKey))
            {
                var mru = StorageApplicationPermissions.MostRecentlyUsedList;
                mru.Add(file, mruKey);
            }

            return file;
        }

        public static async Task<StorageFolder> SelectFolder(string mruKey = null)
        {
            var picker = new Windows.Storage.Pickers.FolderPicker()
            {
                ViewMode = Windows.Storage.Pickers.PickerViewMode.List,
                SuggestedStartLocation = Windows.Storage.Pickers.PickerLocationId.ComputerFolder
            };

            picker.FileTypeFilter.Add("*");

            var folder = await picker.PickSingleFolderAsync();
            if (folder == null)
            {
                return null;
            }

            if (!string.IsNullOrEmpty(mruKey))
            {
                var mru = StorageApplicationPermissions.MostRecentlyUsedList;
                mru.Add(folder, mruKey);
            }

            return folder;
        }
    }
}
