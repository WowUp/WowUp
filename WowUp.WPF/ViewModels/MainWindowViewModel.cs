using System;
using System.Collections.ObjectModel;
using System.Threading.Tasks;
using System.Windows;
using System.Windows.Controls;
using WowUp.WPF.Services.Contracts;
using WowUp.WPF.Views;
using Microsoft.Extensions.DependencyInjection;
using WowUp.WPF.Utilities;
using WowUp.WPF.Extensions;
using WowUp.WPF.Services;

namespace WowUp.WPF.ViewModels
{
    public class MainWindowViewModel : BaseViewModel
    {
        private readonly IServiceProvider _serviceProvider;
        private readonly IWarcraftService _warcraftService;
        private readonly IWowUpService _wowUpService;

        private System.Threading.Timer _timer;

        public Command SelectWowCommand { get; set; }
        public Command DownloadLatestVersionCommand { get; set; }

        private string _title;
        public string Title
        {
            get => _title;
            set { SetProperty(ref _title, value); }
        }

        private bool _showWowSelection;
        public bool ShowWowSelection
        {
            get => _showWowSelection;
            set { SetProperty(ref _showWowSelection, value); }
        }

        private bool _showTabs;
        public bool ShowTabs
        {
            get => _showTabs;
            set { SetProperty(ref _showTabs, value); }
        }

        private Visibility _restoreVisibility;
        public Visibility RestoreVisibility
        {
            get => _restoreVisibility;
            set { SetProperty(ref _restoreVisibility, value); }
        }

        private Visibility _maximizeVisibility;
        public Visibility MaximizeVisibility
        {
            get => _maximizeVisibility;
            set { SetProperty(ref _maximizeVisibility, value); }
        }

        private bool _isUpdateAvailable;
        public bool IsUpdateAvailable 
        {
            get => _isUpdateAvailable;
            set { SetProperty(ref _isUpdateAvailable, value); }
        }

        public ObservableCollection<TabItem> TabItems { get; set; }

        public MainWindowViewModel(
            IServiceProvider serviceProvider,
            IWarcraftService warcraftService,
            IWowUpService wowUpService)
        {
            _serviceProvider = serviceProvider;
            _warcraftService = warcraftService;
            _wowUpService = wowUpService;

            SelectWowCommand = new Command(async () => await SetWowLocation());
            DownloadLatestVersionCommand = new Command(() => DownloadLatestVersion());

            TabItems = new ObservableCollection<TabItem>();

            _timer = new System.Threading.Timer(CheckVersion, null, TimeSpan.Zero, TimeSpan.FromMinutes(10));

            InitializeView();
        }

        public void SetRestoreMaximizeVisibility(WindowState windowState)
        {
            if (windowState == WindowState.Maximized)
            {
                MaximizeVisibility = Visibility.Collapsed;
                RestoreVisibility = Visibility.Visible;
            }
            else
            {
                MaximizeVisibility = Visibility.Visible;
                RestoreVisibility = Visibility.Collapsed;
            }
        }

        private async void InitializeView()
        {
            var hasWowLocation = await HasWarcraftLocation();

            ShowWowSelection = !hasWowLocation;
            ShowTabs = hasWowLocation;

            if (ShowTabs)
            {
                CreateTabs();
            }
        }

        private async void CheckVersion(object state)
        {
            IsUpdateAvailable = await _wowUpService.IsUpdateAvailable();
        }

        private void CreateTabs()
        {
            var tabStyle = System.Windows.Application.Current.TryFindResource("CustomTabItemStyle") as Style;

            var addonsTab = new TabItem
            {
                Name = "Addons",
                Header = "My Addons",
                Style = tabStyle,
                Content = _serviceProvider.GetService<AddonsView>()
            };

            var aboutTab = new TabItem
            {
                Name = "About",
                Header = "About",
                Style = tabStyle,
                Content = _serviceProvider.GetService<AboutView>()
            };

            var optionsTab = new TabItem
            {
                Name = "Options",
                Header = "Options",
                Style = tabStyle,
                Content = _serviceProvider.GetService<OptionsView>()
            };

            TabItems.Add(addonsTab);
            TabItems.Add(aboutTab);
            TabItems.Add(optionsTab);
        }

        private async Task<bool> HasWarcraftLocation()
        {
            var wowFolder = await _warcraftService.GetWowFolderPath();
            return _warcraftService.ValidateWowFolder(wowFolder) && !string.IsNullOrEmpty(wowFolder);
        }

        private void DownloadLatestVersion()
        {
            WowUpService.WebsiteUrl.OpenUrlInBrowser();
        }

        private async Task SetWowLocation()
        {
            var selectedPath = DialogUtilities.SelectFolder();
            if (string.IsNullOrEmpty(selectedPath))
            {
                System.Windows.MessageBox.Show("You must select a World of Warcraft folder to continue.");
                return;
            }

            var didSet = await _warcraftService.SetWowFolderPath(selectedPath);
            if (!didSet)
            {
                System.Windows.MessageBox.Show($"Unable to set \"{selectedPath}\" as your World of Warcraft folder");
                return;
            }

            InitializeView();
        }
    }
}
