using System;
using System.Collections.Generic;
using System.Text;
using System.Threading.Tasks;
using System.Xml.Linq;
using WowUp.WPF.Services.Contracts;
using WowUp.WPF.Utilities;

namespace WowUp.WPF.ViewModels
{
    public class OptionsViewModel : BaseViewModel
    {
        private readonly IWarcraftService _warcraftService;

        private string _wowLocation;
        public string WowLocation
        {
            get => _wowLocation;
            set { SetProperty(ref _wowLocation, value); }
        }

        public OptionsViewModel(
            IWarcraftService warcraftService)
        {
            _warcraftService = warcraftService;

            LoadOptions();
        }

        private async void LoadOptions()
        {
            WowLocation = await _warcraftService.GetWowFolderPath();
        }

        public async void SetWowLocation()
        {
            var selectedPath = DialogUtilities.SelectFolder();
            if (string.IsNullOrEmpty(selectedPath))
            {
                return;
            }

            var didSet = await _warcraftService.SetWowFolderPath(selectedPath);
            if (!didSet)
            {
                System.Windows.MessageBox.Show($"Unable to set \"{selectedPath}\" as your World of Warcraft folder");
                return;
            }

            WowLocation = selectedPath;
        }
    }
}
