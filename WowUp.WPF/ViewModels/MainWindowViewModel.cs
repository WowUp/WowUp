using System;
using System.Collections.ObjectModel;
using System.Windows;
using System.Windows.Controls;
using WowUp.WPF.Services.Contracts;
using WowUp.WPF.Views;
using Microsoft.Extensions.DependencyInjection;
using WowUp.WPF.Utilities;
using WowUp.WPF.Extensions;
using WowUp.WPF.Repositories.Contracts;
using WowUp.WPF.Entities;
using WowUp.Common.Services.Contracts;
using System.Linq;

namespace WowUp.WPF.ViewModels
{
    public class MainWindowViewModel : BaseViewModel
    {
        private const string WindowPlacementKey = "window_placement";

        private readonly IServiceProvider _serviceProvider;
        private readonly IWarcraftService _warcraftService;
        private readonly IWowUpService _wowUpService;
        private readonly IPreferenceRepository _preferenceRepository;
        private readonly IAnalyticsService _analyticsService;

        public Command SelectWowCommand { get; set; }
        public Command CloseWindowCommand { get; set; }

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

        public ApplicationUpdateControlViewModel ApplicationUpdateControlViewModel { get; set; }

        public MainWindowViewModel(
            IAnalyticsService analyticsService,
            IMigrationService migrationService,
            IPreferenceRepository preferenceRepository,
            IServiceProvider serviceProvider,
            IWarcraftService warcraftService,
            IWowUpService wowUpService)
        {
            _analyticsService = analyticsService;
            _preferenceRepository = preferenceRepository;
            _serviceProvider = serviceProvider;
            _warcraftService = warcraftService;
            _wowUpService = wowUpService;

            SelectWowCommand = new Command(() => { });
            CloseWindowCommand = new Command(() => OnCloseWindow());

            ApplicationUpdateControlViewModel = serviceProvider.GetService<ApplicationUpdateControlViewModel>();

            TabItems = new ObservableCollection<TabItem>();

            migrationService.MigrateDatabase();

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

        public void OnLoaded()
        {
            _analyticsService.PromptTelemetry();
            _analyticsService.TrackStartup();
        }

        public void OnSourceInitialized(Window window)
        {
            var windowPref = _preferenceRepository.FindByKey(WindowPlacementKey);
            if(windowPref == null)
            {
                return;
            }

            try
            {
                window.SetPlacement(windowPref.Value);
            }
            catch (Exception)
            {
                // eat
            }
        }

        public void OnClosing(Window window)
        {
            var placement = window.GetPlacement();
            var windowPref = _preferenceRepository.FindByKey(WindowPlacementKey);
            if(windowPref == null)
            {
                windowPref = new Preference
                {
                    Key = WindowPlacementKey,
                    Value = placement
                };
            }
            else
            {
                windowPref.Value = placement;
            }

            _preferenceRepository.SaveItem(windowPref);
        }

        private void OnCloseWindow()
        {
            if (!_wowUpService.GetCollapseToTray())
            {
                Application.Current.MainWindow.Close();
                return;
            }

            Application.Current.MainWindow.Hide();
            Application.Current.MainWindow.WindowState = WindowState.Minimized;
        }

        private void InitializeView()
        {
            var hasWowLocation = HasWarcraftLocation();

            ShowWowSelection = !hasWowLocation;
            ShowTabs = hasWowLocation;

            if (ShowTabs)
            {
                CreateTabs();
            }
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

            var getAddonsTab = new TabItem
            {
                Name = "GetAddons",
                Header = "Get Addons",
                Style = tabStyle,
                Content = _serviceProvider.GetService<GetAddonsView>()
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
            TabItems.Add(getAddonsTab);
            TabItems.Add(aboutTab);
            TabItems.Add(optionsTab);
        }

        private bool HasWarcraftLocation()
        {
            var wowLocations = _warcraftService.GetClientLocations();

            return wowLocations.Any(loc => !string.IsNullOrEmpty(loc));
        }

        //private async Task SetWowLocation()
        //{
        //    var selectedPath = DialogUtilities.SelectFolder();
        //    if (string.IsNullOrEmpty(selectedPath))
        //    {
        //        System.Windows.MessageBox.Show("You must select a World of Warcraft folder to continue.");
        //        return;
        //    }

        //    var didSet = await _warcraftService.SetWowFolderPath(selectedPath);
        //    if (!didSet)
        //    {
        //        System.Windows.MessageBox.Show($"Unable to set \"{selectedPath}\" as your World of Warcraft folder");
        //        return;
        //    }

        //    InitializeView();
        //}
    }
}
