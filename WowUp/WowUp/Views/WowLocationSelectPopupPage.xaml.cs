using System;
using WowUp.Services;
using Xamarin.Forms;
using Xamarin.Forms.Xaml;

namespace WowUp.Views
{
    [XamlCompilation(XamlCompilationOptions.Compile)]
    public partial class WowLocationSelectPopupPage : Rg.Plugins.Popup.Pages.PopupPage
    {
        private readonly IWarcraftService _warcraftService = DependencyService.Get<IWarcraftService>();

        private bool _showRetailSection = false;
        private bool _showClassicSection = false;
        private string _retailPath = string.Empty;
        private string _classicPath = string.Empty;

        public bool ShowRetailSection
        {
            get => _showRetailSection;
            set
            {
                _showRetailSection = value;
                OnPropertyChanged(nameof(ShowRetailSection));
            }
        }

        public bool ShowClassicSection
        {
            get => _showClassicSection;
            set
            {
                _showClassicSection = value;
                OnPropertyChanged(nameof(ShowClassicSection));
            }
        }

        public bool ShowRetailPath { get => !string.IsNullOrEmpty(RetailPath); }
        public bool ShowClassicPath { get => !string.IsNullOrEmpty(ClassicPath); }

        public string RetailPath
        {
            get => _retailPath;
            set
            {
                _retailPath = value;
                OnPropertyChanged(nameof(RetailPath));
                OnPropertyChanged(nameof(ShowRetailPath));
            }
        }

        public string ClassicPath
        {
            get => _classicPath;
            set
            {
                _classicPath = value;
                OnPropertyChanged(nameof(ClassicPath));
                OnPropertyChanged(nameof(ShowClassicPath));
            }
        }

        public WowLocationSelectPopupPage()
        {
            InitializeComponent();
            BindingContext = this;

        }

        private async void LoadWowData()
        {
            RetailPath = await _warcraftService.GetRetailFolderPath();
            ClassicPath = await _warcraftService.GetClassicFolderPath();
        }

        // Invoked when background is clicked
        protected override bool OnBackgroundClicked()
        {
            // Return false if you don't want to close this popup page when a background of the popup page is clicked
            //return base.OnBackgroundClicked();

            return false;
        }

        private async void SelectRetail_Clicked(object sender, EventArgs e)
        {
            var wowFolder = await _warcraftService.SelectWowFolder();
            if (wowFolder == null)
            {
                return;
            }

            LoadWowData();
        }
    }
}