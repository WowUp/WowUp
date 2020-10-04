using Hardcodet.Wpf.TaskbarNotification;
using Microsoft.Extensions.DependencyInjection;
using System;
using System.Collections.ObjectModel;
using System.Linq;
using System.Windows;
using System.Windows.Controls;
using WowUp.Common.Enums;
using WowUp.WPF.Entities;
using WowUp.WPF.Extensions;
using WowUp.WPF.Repositories.Contracts;
using WowUp.WPF.Services.Contracts;
using WowUp.WPF.Utilities;
using WowUp.WPF.Views;

namespace WowUp.WPF.ViewModels
{
    public class MainWindowViewModel : BaseViewModel
    {
        private const string WindowPlacementKey = "window_placement";
        private const string WindowStateKey = "window_state";

        private readonly IServiceProvider _serviceProvider;
        private readonly IWarcraftService _warcraftService;
        private readonly IWowUpService _wowUpService;
        private readonly IPreferenceRepository _preferenceRepository;
        private readonly IAnalyticsService _analyticsService;
        private readonly ISessionService _sessionService;

        public ObservableCollection<WowClientType> WowClientTypes { get; set; }
        public ObservableCollection<TabItem> TabItems { get; set; }

        public Command SelectWowCommand { get; set; }
        public Command CloseWindowCommand { get; set; }
        public Command TaskbarIconCloseCommand { get; set; }
        public Command TaskbarIconClickCommand { get; set; }
        public Command SetWowLocationCommand { get; set; }
        public Command SelectedWowClientChangedCommand { get; set; }

        private TaskbarIcon _taskbarIcon;
        public TaskbarIcon TaskbarIcon
        {
            get => _taskbarIcon;
            set
            {
                _taskbarIcon = value;
                _sessionService.TaskbarIcon = value;
            }
        }

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

        private int _selectedTabIndex;
        public int SelectedTabIndex
        {
            get => _selectedTabIndex;
            set { 
                SetProperty(ref _selectedTabIndex, value);
                OnSelectedTabChanged(value);
            }
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

        private string _version;
        public string Version
        {
            get => _version;
            set { SetProperty(ref _version, value); }
        }

        private string _statusText;
        public string StatusText
        {
            get => _statusText;
            set { SetProperty(ref _statusText, value); }
        }

        private string _contextText;
        public string ContextText
        {
            get => _contextText;
            set { SetProperty(ref _contextText, value); }
        }

        private WowClientType _selectedClientType;
        public WowClientType SelectedClientType
        {
            get => _selectedClientType;
            set { SetProperty(ref _selectedClientType, value); }
        }

        private string _wowClientHint;
        public string WowClientHint
        {
            get => _wowClientHint;
            set { SetProperty(ref _wowClientHint, value); }
        }

        public ApplicationUpdateControlViewModel ApplicationUpdateControlViewModel { get; set; }

        public MainWindowViewModel(
            IAnalyticsService analyticsService,
            IMigrationService migrationService,
            IPreferenceRepository preferenceRepository,
            IServiceProvider serviceProvider,
            ISessionService sessionService,
            IWarcraftService warcraftService,
            IWowUpService wowUpService)
        {
            _analyticsService = analyticsService;
            _preferenceRepository = preferenceRepository;
            _serviceProvider = serviceProvider;
            _sessionService = sessionService;
            _warcraftService = warcraftService;
            _wowUpService = wowUpService;

            SelectWowCommand = new Command(() => { });
            CloseWindowCommand = new Command(() => OnCloseWindow());
            TaskbarIconCloseCommand = new Command(() => OnTaskbarIconClose());
            TaskbarIconClickCommand = new Command(() => OnTaskbarIconClick());
            SetWowLocationCommand = new Command(() => OnSetWowLocation());
            SelectedWowClientChangedCommand = new Command(() => OnSelectedWowClientChanged());

            ApplicationUpdateControlViewModel = serviceProvider.GetService<ApplicationUpdateControlViewModel>();

            TabItems = new ObservableCollection<TabItem>();

            WowClientTypes = new ObservableCollection<WowClientType>(
                Enum.GetValues(typeof(WowClientType))
                    .Cast<WowClientType>()
                    .Where(type => type != WowClientType.None));

            migrationService.MigrateDatabase();

            InitializeView();

            _sessionService.SessionChanged += SessionService_SessionChanged;
            _sessionService.ContextTextChanged += SessionService_ContextTextChanged;

            SetClientHint();
        }

        /// <summary>
        /// Handle when the user wants to change the install folder for a particular client
        /// </summary>
        /// <param name="clientType"></param>
        private void OnSetWowLocation()
        {
            var selectedPath = DialogUtilities.SelectFolder();
            if (string.IsNullOrEmpty(selectedPath))
            {
                return;
            }

            if (!_warcraftService.SetWowFolderPath(SelectedClientType, selectedPath))
            {
                MessageBox.Show($"Unable to set \"{selectedPath}\" as your {SelectedClientType} folder");
                return;
            }

            _sessionService.SelectedClientType = SelectedClientType;
            InitializeView();
        }

        private void OnSelectedWowClientChanged()
        {
            SetClientHint();
        }

        private void SetClientHint()
        {
            var clientFolderName = _warcraftService.GetClientFolderName(SelectedClientType);
            WowClientHint = $"Select the folder that contains the {SelectedClientType} client folder _{clientFolderName}";
        }

        private void OnTaskbarIconClick()
        {
            if (Application.Current?.MainWindow == null)
            {
                return;
            }

            Application.Current.MainWindow.ShowInTaskbar = true;
            Application.Current.MainWindow.Show();
            Application.Current.MainWindow.WindowState = WindowState.Normal;
            Application.Current.MainWindow.Activate();
        }

        private void OnTaskbarIconClose()
        {
            Application.Current?.MainWindow?.Close();
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

        public async void OnLoaded()
        {
            _analyticsService.PromptTelemetry();
            await _analyticsService.TrackStartup();

            Version = $"v{AppUtilities.LongVersionName}";

            _sessionService.AppLoaded();
        }

        public void OnSourceInitialized(Window window)
        {
            if (App.StartupOptions?.Minimized == true)
            {
                window.Hide();
                window.ShowInTaskbar = false;
                window.WindowState = WindowState.Minimized;
            }

            var windowPref = _preferenceRepository.FindByKey(WindowPlacementKey);
            var windowStatePref = _preferenceRepository.FindByKey(WindowStateKey);
            if (windowPref == null)
            {
                return;
            }

            if (windowStatePref != null && Enum.TryParse<WindowState>(windowStatePref.Value, true, out var windowState))
            {
                window.WindowState = windowState;
            }

            if(window.WindowState == WindowState.Maximized)
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
            if (windowPref == null)
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

            var windowStatePref = _preferenceRepository.FindByKey(WindowStateKey);
            if(windowStatePref == null)
            {
                windowStatePref = new Preference
                {
                    Key = WindowStateKey
                };
            } 

            windowStatePref.Value = window.WindowState.ToString();
            _preferenceRepository.SaveItem(windowStatePref);
        }

        private void OnSelectedTabChanged(int selectedTabIndex)
        {
            var tab = TabItems[selectedTabIndex];
            if(tab.Content is UserControl)
            {
                _sessionService.SelectedTabType = (tab.Content as UserControl).DataContext.GetType();
            }
        }

        private void SessionService_ContextTextChanged(object sender, string text)
        {
            ContextText = text;
        }

        private void SessionService_SessionChanged(object sender, Common.Models.Events.SessionEventArgs e)
        {
            StatusText = e.SessionState.StatusText;
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
            var tabStyle = Application.Current.TryFindResource("CustomTabItemStyle") as Style;

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

            _sessionService.SelectedTabType = (addonsTab.Content as UserControl).DataContext.GetType();
        }

        private bool HasWarcraftLocation()
        {
            var wowLocations = _warcraftService.GetClientLocations();

            return wowLocations.Any(loc => !string.IsNullOrEmpty(loc));
        }
    }
}
