using WowUp.WPF.Services.Contracts;
using WowUp.WPF.Utilities;

namespace WowUp.WPF.ViewModels
{
    public class OptionsViewModel : BaseViewModel
    {
        private readonly IWarcraftService _warcraftService;
        private readonly IWowUpService _wowUpService;

        private string _wowLocation;
        public string WowLocation
        {
            get => _wowLocation;
            set { SetProperty(ref _wowLocation, value); }
        }

        public Command ShowLogsCommand { get; set; }

        public OptionsViewModel(
            IWarcraftService warcraftService,
            IWowUpService wowUpService)
        {
            _warcraftService = warcraftService;
            _wowUpService = wowUpService;

            ShowLogsCommand = new Command(() => ShowLogsFolder());

            LoadOptions();
        }

        private async void LoadOptions()
        {
            WowLocation = await _warcraftService.GetWowFolderPath();
        }

        private void ShowLogsFolder() 
        {
            _wowUpService.ShowLogsFolder();
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
