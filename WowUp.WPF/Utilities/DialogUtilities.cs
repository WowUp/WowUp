using System;
using System.Windows.Forms;

namespace WowUp.WPF.Utilities
{
    public static class DialogUtilities
    {
        public static string SelectFolder()
        {
            using var dialog = new FolderBrowserDialog
            {
                RootFolder = Environment.SpecialFolder.MyComputer
            };

            DialogResult result = dialog.ShowDialog();
            if (result != DialogResult.OK)
            {
                return string.Empty;
            }

            return dialog.SelectedPath;
        }
    }
}
