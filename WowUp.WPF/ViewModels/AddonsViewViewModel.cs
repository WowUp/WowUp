using Microsoft.Extensions.DependencyInjection;
using Serilog;
using System;
using System.Collections.Generic;
using System.Collections.ObjectModel;
using System.ComponentModel;
using System.Linq;
using System.Threading.Tasks;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Data;
using WowUp.Common.Enums;
using WowUp.WPF.Entities;
using WowUp.WPF.Extensions;
using WowUp.WPF.Services.Contracts;
using WowUp.WPF.Utilities;

namespace WowUp.WPF.ViewModels
{
    public class AddonsViewViewModel : BaseViewModel
    {
        private static readonly object ClientNamesLock = new object();
        private static readonly object DisplayAddonsLock = new object();

        private readonly IAnalyticsService _analyticsService;
        private readonly IServiceProvider _serviceProvider;
        private readonly IWarcraftService _warcraftService;
        private readonly IAddonService _addonService;
        private readonly ISessionService _sessionService;
        private readonly IWowUpService _wowupService;
        
        private List<Addon> _addons;
        private bool _disableUpdateLoad;
        private IEnumerable<AddonListItemViewModel> _selectedRows;
        private IEnumerable<Addon> _selectedAddons;

        private string _busyText;
        public string BusyText
        {
            get => _busyText;
            set { SetProperty(ref _busyText, value); }
        }

        private bool _showEmptyLabel;
        public bool ShowEmptyLabel
        {
            get => _showEmptyLabel;
            set { SetProperty(ref _showEmptyLabel, value); }
        }

        private bool _showResults;
        public bool ShowResults
        {
            get => _showResults;
            set { SetProperty(ref _showResults, value); }
        }

        private bool _enableUpdateAll;
        public bool EnableUpdateAll
        {
            get => _enableUpdateAll;
            set { SetProperty(ref _enableUpdateAll, value); }
        }

        private bool _enableRefresh;
        public bool EnableRefresh
        {
            get => _enableRefresh;
            set { SetProperty(ref _enableRefresh, value); }
        }

        private bool _enableReScan;
        public bool EnableRescan
        {
            get => _enableReScan;
            set { SetProperty(ref _enableReScan, value); }
        }

        private string _addonHeaderText = "Addon";
        public string AddonHeaderText
        {
            get => _addonHeaderText;
            set { SetProperty(ref _addonHeaderText, value); }
        }

        private string _statusHeaderText = "Status";
        public string StatusHeaderText
        {
            get => _statusHeaderText;
            set { SetProperty(ref _statusHeaderText, value); }
        }

        private string _providerHeaderText = "Provider";
        public string ProviderHeaderText
        {
            get => _providerHeaderText;
            set { SetProperty(ref _providerHeaderText, value); }
        }

        private string _gameVersionHeaderText = "Game Version";
        public string GameVersionHeaderText
        {
            get => _gameVersionHeaderText;
            set { SetProperty(ref _gameVersionHeaderText, value); }
        }

        private string _latestVersionHeaderText = "Latest Version";
        public string LatestVersionHeaderText
        {
            get => _latestVersionHeaderText;
            set { SetProperty(ref _latestVersionHeaderText, value); }
        }

        private string _authorHeaderText = "Author";
        public string AuthorHeaderText
        {
            get => _authorHeaderText;
            set { SetProperty(ref _authorHeaderText, value); }
        }

        public ListSortDirection? _addonNameSortDirection;
        public ListSortDirection? AddonNameSortDirection
        {
            get => _addonNameSortDirection;
            set { SetProperty(ref _addonNameSortDirection, value); }
        }

        public ListSortDirection? _providerNameSortDirection;
        public ListSortDirection? ProviderNameSortDirection
        {
            get => _providerNameSortDirection;
            set { SetProperty(ref _providerNameSortDirection, value); }
        }

        public ListSortDirection? _gameVersionSortDirection;
        public ListSortDirection? GameVersionSortDirection
        {
            get => _gameVersionSortDirection;
            set { SetProperty(ref _gameVersionSortDirection, value); }
        }

        public ListSortDirection? _latestVersionSortDirection;
        public ListSortDirection? LatestVersionSortDirection
        {
            get => _latestVersionSortDirection;
            set { SetProperty(ref _latestVersionSortDirection, value); }
        }

        public ListSortDirection? _statusSortDirection;
        public ListSortDirection? StatusSortDirection
        {
            get => _statusSortDirection;
            set { SetProperty(ref _statusSortDirection, value); }
        }

        public ListSortDirection? _authorSortDirection;
        public ListSortDirection? AuthorSortDirection
        {
            get => _authorSortDirection;
            set { SetProperty(ref _authorSortDirection, value); }
        }

        private AddonListItemViewModel _selectedRow;
        public AddonListItemViewModel SelectedRow
        {
            get => _selectedRow;
            set { SetProperty(ref _selectedRow, value); }
        }

        private WowClientType _selectedClientType;
        public WowClientType SelectedClientType
        {
            get => _selectedClientType;
            set { SetProperty(ref _selectedClientType, value); }
        }

        private ContextMenu _activeContextMenu;
        public ContextMenu ActiveContextMenu
        {
            get => _activeContextMenu;
            set { SetProperty(ref _activeContextMenu, value); }
        }

        private string _multiRowMenuTitle;
        public string MultiRowMenuTitle
        {
            get => _multiRowMenuTitle;
            set { SetProperty(ref _multiRowMenuTitle, value); }
        }

        private bool _multiRowMenuAutoUpdateCheck;
        public bool MultiRowMenuAutoUpdateCheck
        {
            get => _multiRowMenuAutoUpdateCheck;
            set { SetProperty(ref _multiRowMenuAutoUpdateCheck, value); }
        }

        private bool _multiRowMenuStableChannelCheck;
        public bool MultiRowMenuStableChannelCheck
        {
            get => _multiRowMenuStableChannelCheck;
            set { SetProperty(ref _multiRowMenuStableChannelCheck, value); }
        }

        private bool _multiRowMenuBetaChannelCheck;
        public bool MultiRowMenuBetaChannelCheck
        {
            get => _multiRowMenuBetaChannelCheck;
            set { SetProperty(ref _multiRowMenuBetaChannelCheck, value); }
        }

        private bool _multiRowMenuAlphaChannelCheck;
        public bool MultiRowMenuAlphaChannelCheck
        {
            get => _multiRowMenuAlphaChannelCheck;
            set { SetProperty(ref _multiRowMenuAlphaChannelCheck, value); }
        }

        public SearchInputViewModel SearchInputViewModel { get; set; }

        public Command LoadItemsCommand { get; set; }
        public Command RefreshCommand { get; set; }
        public Command RescanCommand { get; set; }
        public Command UpdateAllCommand { get; set; }
        public Command UpdateAllRetailClassicCommand { get; set; }
        public Command UpdateAllClientAddonsCommand { get; set; }
        public Command SelectedWowClientCommand { get; set; }
        public Command GridSortingCommand { get; set; }
        public Command ViewInitializedCommand { get; set; }
        public Command AutoUpdateCheckedCommand { get; set; }
        public Command StableChannelCheckedCommand { get; set; }
        public Command BetaChannelCheckedCommand { get; set; }
        public Command AlphaChannelCheckedCommand { get; set; }
        public Command ReInstallAllCommand { get; set; }
        public Command UninstallAllCommand { get; set; }

        public ContextMenu MultiRowMenu { get; set; }
        public ContextMenu RowMenu { get; set; }

        public ObservableCollection<AddonListItemViewModel> DisplayAddons { get; set; }
        public ObservableCollection<WowClientType> ClientTypeNames { get; set; }

        public AddonsViewViewModel(
            IAnalyticsService analyticsService,
            IServiceProvider serviceProvider,
            IAddonService addonService,
            IWarcraftService warcraftService,
            ISessionService sessionService,
            IWowUpService wowupService)
        {
            _addonService = addonService;
            _analyticsService = analyticsService;
            _warcraftService = warcraftService;
            _serviceProvider = serviceProvider;
            _sessionService = sessionService;
            _wowupService = wowupService;
            _addons = new List<Addon>();

            _addonService.AddonInstalled += (sender, args) =>
            {
                AddAddonListItem(args.Addon);
            };

            _addonService.AddonUninstalled += (sender, args) =>
            {
                RemoveAddonListItem(args.Addon);
            };

            _addonService.AddonUpdated += (sender, args) =>
            {
                AddonUpdated(args.Addon);
            };

            _addonService.AddonStateChanged += (sender, args) =>
            {
                var addon = DisplayAddons.FirstOrDefault(listItem => listItem.Addon.Id == args.Addon.Id);
                if(addon != null)
                {
                    addon.OnInstallUpdate(args.AddonInstallState, args.Progress);
                }
            };

            _warcraftService.ProductChanged += (sender, args) =>
            {
                SetClientNames();
            };

            _sessionService.SessionChanged += (sender, args) =>
            {
                SelectedClientType = args.SessionState.SelectedClientType;
            };

            _sessionService.TabChanged += SessionService_TabChanged;

            ClientTypeNames = new ObservableCollection<WowClientType>();
            DisplayAddons = new ObservableCollection<AddonListItemViewModel>();
            LoadItemsCommand = new Command(async () => await LoadItems());
            RefreshCommand = new Command(async () => await LoadItems());
            RescanCommand = new Command(async () => await ReScan());
            UpdateAllCommand = new Command(async () => await UpdateAll());
            UpdateAllRetailClassicCommand = new Command(async () => await UpdateAllRetailClassic());
            UpdateAllClientAddonsCommand = new Command(async () => await UpdateAllClientAddons());
            SelectedWowClientCommand = new Command(async () => await OnSelectedWowClientChanged(SelectedClientType));
            GridSortingCommand = new Command((args) => OnGridSorting(args as DataGridSortingEventArgs));
            ViewInitializedCommand = new Command(() => OnViewInitialized());
            AutoUpdateCheckedCommand = new Command(() => OnAutoUpdateCheckedCommand());
            StableChannelCheckedCommand = new Command(() => OnChangeAllChannelCommand(AddonChannelType.Stable));
            BetaChannelCheckedCommand = new Command(() => OnChangeAllChannelCommand(AddonChannelType.Beta));
            AlphaChannelCheckedCommand = new Command(() => OnChangeAllChannelCommand(AddonChannelType.Alpha));
            ReInstallAllCommand = new Command(async () => await ReInstallAll());
            UninstallAllCommand = new Command(async () => await UninstallAll());

            SearchInputViewModel = serviceProvider.GetService<SearchInputViewModel>();
            SearchInputViewModel.TextChanged += SearchInputViewModel_TextChanged;
            SearchInputViewModel.Searched += SearchInputViewModel_Searched;

            BindingOperations.EnableCollectionSynchronization(ClientTypeNames, ClientNamesLock);
            BindingOperations.EnableCollectionSynchronization(DisplayAddons, DisplayAddonsLock);

            SelectedClientType = _sessionService.SelectedClientType;

            BusyText = string.Empty;

            SetClientNames();

            Initialize();
        }

        private void OnAutoUpdateCheckedCommand()
        {
            _disableUpdateLoad = true;
            foreach (var addon in _selectedAddons)
            {
                addon.AutoUpdateEnabled = MultiRowMenuAutoUpdateCheck;
                _addonService.UpdateAddon(addon);

                var listItem = DisplayAddons.FirstOrDefault(item => item.Addon.Id == addon.Id);
                listItem.IsAutoUpdated = addon.AutoUpdateEnabled;
            }
            _disableUpdateLoad = false;
        }

        private void OnChangeAllChannelCommand(AddonChannelType addonChannel)
        {
            _disableUpdateLoad = true;
            foreach (var addon in _selectedAddons)
            {
                addon.ChannelType = addonChannel;
                _addonService.UpdateAddon(addon);

                var listItem = DisplayAddons.FirstOrDefault(item => item.Addon.Id == addon.Id);
                listItem.Addon.ChannelType = addonChannel;
                listItem.SetupDisplayState();
            }

            SetSelectionChannelState();

            _disableUpdateLoad = false;
        }

        private async Task ReInstallAll()
        {
            IsBusy = true;
            EnableUpdateAll = false;
            EnableRefresh = false;
            EnableRescan = false;

            await _selectedAddons.ForEachAsync(2, async (addon) =>
            {
                try
                {
                    await _addonService.InstallAddon(addon.Id);
                }
                catch (Exception ex)
                {
                    _analyticsService.Track(ex, "Failed during bulk install");
                }
            });

            IsBusy = false;
            EnableUpdateAll = CanUpdateAll;
            EnableRefresh = true;
            EnableRescan = true;

            await _analyticsService.TrackUserAction(
                "Addons", 
                "ReInstallBulk", 
                _selectedAddons.Count().ToString());
        }

        public async Task UninstallAll()
        {
            var messageBoxResult = MessageBox.Show(
                $"Are you sure you want to remove {_selectedAddons.Count()} addons? This will remove all related folders from your World of Warcraft folder.",
                "Uninstall Addon?",
                MessageBoxButton.YesNo);

            if (messageBoxResult != MessageBoxResult.Yes)
            {
                return;
            }

            var uninstallDependencies = false;
            if(_selectedAddons.Any(addon => addon.Dependencies != null && addon.Dependencies.Any())){
                messageBoxResult = MessageBox.Show(
                    $"Some of the selected addons have dependencies, do you want to uninstall the dependency addons?",
                    "Uninstall Addon Dependencies?",
                    MessageBoxButton.YesNo);

                uninstallDependencies = messageBoxResult == MessageBoxResult.Yes;
            }

            IsBusy = true;
            EnableUpdateAll = false;
            EnableRefresh = false;
            EnableRescan = false;

            foreach (var addon in _selectedAddons.ToList())
            {
                try
                {
                    await _addonService.UninstallAddon(addon, uninstallDependencies);
                }
                catch (Exception ex)
                {
                    Log.Error(ex, $"Failed to uninstall addon {addon.Name}");
                }
            }

            IsBusy = false;
            EnableUpdateAll = CanUpdateAll;
            EnableRefresh = true;
            EnableRescan = true;

            await _analyticsService.TrackUserAction(
                "Addons",
                "UninstallBulk",
                _selectedAddons.Count().ToString());
        }

        public void OnDataGridSelectionChange(
            IEnumerable<AddonListItemViewModel> selectedItems)
        {
            _selectedRows = selectedItems;
            _selectedAddons = selectedItems.Select(item => item.Addon);
            MultiRowMenuTitle = selectedItems.Count() > 1
               ? $"{selectedItems.Count()} addons selected"
               : string.Empty;

            ActiveContextMenu = selectedItems.Count() > 1
                ? MultiRowMenu
                : RowMenu;

            MultiRowMenuAutoUpdateCheck = selectedItems.All(item => item.IsAutoUpdated);

            SetSelectionChannelState();
        }

        private void SetSelectionChannelState()
        {
            MultiRowMenuStableChannelCheck = _selectedRows
                .All(item => item.Addon.ChannelType == AddonChannelType.Stable);

            MultiRowMenuBetaChannelCheck = _selectedRows
                .All(item => item.Addon.ChannelType == AddonChannelType.Beta);

            MultiRowMenuAlphaChannelCheck = _selectedRows
                .All(item => item.Addon.ChannelType == AddonChannelType.Alpha);
        }

        private void SessionService_TabChanged(object sender, Type tabType)
        {
            SetAddonCountContextText(DisplayAddons.Count);
        }

        private void SearchInputViewModel_Searched(object sender, Models.Events.SearchInputEventArgs e)
        {
        }

        private void SearchInputViewModel_TextChanged(object sender, Models.Events.SearchInputEventArgs e)
        {
            FilterAddons(e.Text);
        }

        private void OnViewInitialized()
        {
        }

        private void ResetSorting()
        {
            AddonNameSortDirection = null;
            AuthorSortDirection = null;
            GameVersionSortDirection = null;
            LatestVersionSortDirection = null;
            ProviderNameSortDirection = null;
            StatusSortDirection = null;
        }

        private void OnGridSorting(DataGridSortingEventArgs args)
        {
            ResetSorting();

            var nextSortDirection = GetNextSortDirection(args.Column.SortDirection);

            switch (args.Column.SortMemberPath)
            {
                case "Name":
                    AddonNameSortDirection = nextSortDirection;
                    break;
                case "ProviderName":
                    ProviderNameSortDirection = nextSortDirection;
                    break;
                case "GameVersion":
                    GameVersionSortDirection = nextSortDirection;
                    break;
                case "LatestVersion":
                    LatestVersionSortDirection = nextSortDirection;
                    break;
                case "DisplayState":
                    StatusSortDirection = nextSortDirection;
                    break;
                case "Author":
                    AuthorSortDirection = nextSortDirection;
                    break;
                default:
                    break;
            }
        }

        private ListSortDirection? GetNextSortDirection(ListSortDirection? sortDirection)
        {
            if (sortDirection == null)
            {
                return ListSortDirection.Ascending;
            }
            else if (sortDirection == ListSortDirection.Ascending)
            {
                return ListSortDirection.Descending;
            }
            else
            {
                return ListSortDirection.Ascending;
            }
        }

        private void SetClientNames()
        {
            lock (ClientNamesLock)
            {
                ClientTypeNames.Clear();

                foreach(var clientType in _warcraftService.GetWowClientTypes())
                {
                    if(clientType == WowClientType.None)
                    {
                        continue;
                    }

                    ClientTypeNames.Add(clientType);
                }
            }
        }

        private async void Initialize()
        {
            if (_wowupService.IsReScanRequired())
            {
                try
                {
                    await ReScan(false);
                    _wowupService.SetRequiredReScanCompleted();
                }
                catch(Exception ex)
                {
                    Log.Error(ex, "Required rescan failed");
                }
            }

            await LoadItems();
        }

        public async Task UpdateAll()
        {
            EnableUpdateAll = false;
            EnableRefresh = false;
            EnableRescan = false;
            IsBusy = true;

            try
            {
                await DisplayAddons.ToList()
                    .Where(addon => addon.CanUpdate || addon.CanInstall)
                    .ForEachAsync(2, async addon =>
                    {
                        await addon.InstallAddon();
                    });
            }
            finally
            {
                EnableUpdateAll = CanUpdateAll;
                EnableRefresh = true;
                EnableRescan = true;
                IsBusy = false;
            }
        }

        public bool CanUpdateAll => DisplayAddons.Any(addon => addon.CanUpdate || addon.CanInstall);

        public async Task UpdateAllRetailClassic()
        {
            await UpdateAllWithSpinner(WowClientType.Retail, WowClientType.Classic);
        }

        public async Task UpdateAllClientAddons()
        {
            await UpdateAllWithSpinner(
                WowClientType.Retail, 
                WowClientType.RetailPtr,
                WowClientType.Classic,
                WowClientType.ClassicPtr,
                WowClientType.Beta);
        }

        public async Task UpdateAllWithSpinner(params WowClientType[] clientTypes)
        {
            EnableUpdateAll = false;
            EnableRefresh = false;
            EnableRescan = false;
            ShowResults = false;
            IsBusy = true;
            BusyText = "Gathering addons...";

            try
            {
                var updatedCount = 0;
                var allAddons = new List<Addon>();
                foreach(var clientType in clientTypes)
                {
                    allAddons.AddRange(await _addonService.GetAddons(clientType));
                }

                // Only care about the ones that need to be updated/installed
                allAddons = allAddons
                    .Where(addon => addon.CanUpdate() || addon.CanInstall())
                    .ToList();

                BusyText = $"Updating {updatedCount}/{allAddons.Count}";

                foreach (var addon in allAddons)
                {
                    updatedCount += 1;
                    BusyText = $"Updating {updatedCount}/{allAddons.Count}\n{addon.ClientType}: {addon.Name}";

                    await _addonService.InstallAddon(addon.Id);
                }

                await LoadItems();
            }
            catch(Exception ex)
            {
                Log.Error(ex, "Failed to update with spinner");

                EnableUpdateAll = DisplayAddons.Any(addon => addon.CanUpdate || addon.CanInstall);
                EnableRefresh = true;
                EnableRescan = true;
                ShowResults = true;
                IsBusy = false;
            }
        }

        private async Task ReScan(bool promptUser = true)
        {
            if (promptUser)
            {
                var messageBoxResult = MessageBox.Show(
                    "Doing a re-scan will reset the addon information and attempt to re-guess what you have installed. This operation can take a moment.",
                    "Start re-scan?",
                    MessageBoxButton.YesNo);

                if (messageBoxResult != MessageBoxResult.Yes)
                {
                    return;
                }
            }

            await LoadItems(true);
        }

        private void FilterAddons(string filter)
        {
            var filteredAddons = string.IsNullOrEmpty(filter) 
                ? _addons
                : _addons.Where(addon => addon.Name.Contains(filter, StringComparison.OrdinalIgnoreCase));

            ShowResults = filteredAddons.Any();
            ShowEmptyLabel = !filteredAddons.Any();

            var listViewItems = CreateListViewModels(filteredAddons);

            UpdateDisplayAddons(listViewItems);
        }

        public async Task LoadItems(bool forceReload = false)
        {
            IsBusy = true;
            EnableUpdateAll = false;
            ShowResults = false;
            ShowEmptyLabel = false;
            EnableRefresh = false;
            EnableRescan = false;
            BusyText = "Loading Addons...";
            _sessionService.SetContextText(this, string.Empty);

            try
            {
                _addons = await _addonService.GetAddons(SelectedClientType, forceReload);
                _addons = _addons.OrderBy(addon => addon.GetDisplayState())
                    .ThenBy(addon => addon.Name)
                    .ToList();

                var listViewItems = CreateListViewModels(_addons);

                SetAddonCountContextText(listViewItems.Count);

                UpdateDisplayAddons(listViewItems);
            }
            catch (Exception ex)
            {
                Log.Error(ex, "LoadItems");
            }
            finally
            {
                IsBusy = false;
                ShowResults = DisplayAddons.Any();
                ShowEmptyLabel = !DisplayAddons.Any();
                EnableUpdateAll = DisplayAddons.Any(addon => addon.CanUpdate || addon.CanInstall);
                EnableRefresh = true;
                EnableRescan = true;
            }
        }

        private List<AddonListItemViewModel> CreateListViewModels(IEnumerable<Addon> addons)
        {
            var listViewItems = new List<AddonListItemViewModel>();

            foreach (var addon in addons)
            {
                if (string.IsNullOrEmpty(addon.LatestVersion))
                {
                    continue;
                }

                var viewModel = GetAddonViewModel(addon);

                listViewItems.Add(viewModel);
            }

            return listViewItems;
        }

        public async Task OnSelectedWowClientChanged(WowClientType clientType)
        {
            _sessionService.SelectedClientType = _selectedClientType;
            await LoadItems();
        }

        private AddonListItemViewModel GetAddonViewModel(Addon addon)
        {
            var viewModel = _serviceProvider.GetService<AddonListItemViewModel>();
            viewModel.Addon = addon;

            return viewModel;
        }

        private void AddAddonListItem(Addon addon)
        {
            try
            {
                // If an addon not for the currently selected client was installed, ignore it
                if (addon.ClientType != SelectedClientType)
                {
                    return;
                }

                // If this addon is already in the list, ignore it
                var displayItem = DisplayAddons.FirstOrDefault(listItem => listItem.Addon.Id == addon.Id);
                if (displayItem != null)
                {
                    displayItem.ThumbnailUrl = addon.ThumbnailUrl;
                    return;
                }

                var viewModel = GetAddonViewModel(addon);

                lock (DisplayAddonsLock)
                {
                    DisplayAddons.Add(viewModel);
                    SortAddons(DisplayAddons);
                }
            }
            finally
            {
                EnableUpdateAll = DisplayAddons.Any(addon => addon.CanUpdate || addon.CanInstall);
            }
        }

        private void AddonUpdated(Addon addon)
        {
            if (IsBusy || _disableUpdateLoad)
            {
                return;
            }

            System.Windows.Threading.Dispatcher.CurrentDispatcher.Invoke(async () => await LoadItems());
        }

        private void RemoveAddonListItem(Addon addon)
        {
            lock (DisplayAddonsLock)
            {
                DisplayAddons.Remove(DisplayAddons.First(da => addon.Id == da.Addon.Id));
            }
        }

        private void UpdateDisplayAddons(IList<AddonListItemViewModel> addons)
        {
            lock (DisplayAddonsLock)
            {
                DisplayAddons.Clear();

                foreach (var addon in addons)
                {
                    DisplayAddons.Add(addon);
                }
            }
        }

        private void SetAddonCountContextText(int count)
        {
            _sessionService.SetContextText(this, $"{count} addons");
        }

        private static void SortAddons(ObservableCollection<AddonListItemViewModel> addons)
        {
            var sorted = addons
                .OrderBy(addon => addon.DisplayState)
                .ThenBy(addon => addon.Name)
                .ToList();

            for (int i = 0; i < sorted.Count(); i++)
            {
                addons.Move(addons.IndexOf(sorted[i]), i);
            }
        }
    }
}
