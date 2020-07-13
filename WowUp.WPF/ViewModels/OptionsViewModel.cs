using WowUp.Common.Services.Contracts;
using WowUp.WPF.Repositories.Contracts;
using WowUp.WPF.Services.Contracts;
using WowUp.WPF.Utilities;

namespace WowUp.WPF.ViewModels
{
    public class OptionsViewModel : BaseViewModel
    {
        private readonly IAnalyticsService _analyticsService;
        private readonly IWarcraftService _warcraftService;
        private readonly IWowUpService _wowUpService;

        private string _wowLocation;
        public string WowLocation
        {
            get => _wowLocation;
            set { SetProperty(ref _wowLocation, value); }
        }

        private bool _isTelemetryEnabled;
        public bool IsTelemetryEnabled
        {
            get => _isTelemetryEnabled;
            set { SetProperty(ref _isTelemetryEnabled, value); }
        }

        public Command ShowLogsCommand { get; set; }
        public Command TelemetryCheckCommand { get; set; }

        public OptionsViewModel(
            IAnalyticsService analyticsService,
            IWarcraftService warcraftService,
            IWowUpService wowUpService)
        {
            _analyticsService = analyticsService;
            _warcraftService = warcraftService;
            _wowUpService = wowUpService;

            ShowLogsCommand = new Command(() => ShowLogsFolder());
            TelemetryCheckCommand = new Command(() => OnTelemetryChange());

            LoadOptions();
        }

        private async void LoadOptions()
        {
            IsTelemetryEnabled = _analyticsService.IsTelemetryEnabled();
            WowLocation = await _warcraftService.GetWowFolderPath();
        }

        private void ShowLogsFolder() 
        {
            _wowUpService.ShowLogsFolder();
        }

        private void OnTelemetryChange()
        {
            _analyticsService.SetTelemetryEnabled(IsTelemetryEnabled);
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
