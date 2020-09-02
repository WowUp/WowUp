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
using WowUp.Common.Services.Contracts;
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

        private readonly IServiceProvider _serviceProvider;
        private readonly IWarcraftService _warcraftService;
        private readonly IAddonService _addonService;
        private readonly ISessionService _sessionService;
        
        private List<Addon> _addons;

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

        public SearchInputViewModel SearchInputViewModel { get; set; }

        public Command LoadItemsCommand { get; set; }
        public Command RefreshCommand { get; set; }
        public Command RescanCommand { get; set; }
        public Command UpdateAllCommand { get; set; }
        public Command SelectedWowClientCommand { get; set; }
        public Command GridSortingCommand { get; set; }
        public Command ViewInitializedCommand { get; set; }

        public ObservableCollection<AddonListItemViewModel> DisplayAddons { get; set; }
        public ObservableCollection<WowClientType> ClientTypeNames { get; set; }

        public AddonsViewViewModel(
            IServiceProvider serviceProvider,
            IAddonService addonService,
            IWarcraftService warcraftService,
            ISessionService sessionService)
        {
            _addonService = addonService;
            _warcraftService = warcraftService;
            _serviceProvider = serviceProvider;
            _sessionService = sessionService;
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

            _warcraftService.ProductChanged += (sender, args) =>
            {
                SetClientNames();
            };

            _sessionService.SessionChanged += (sender, args) =>
            {
                SelectedClientType = args.SessionState.SelectedClientType;
            };

            ClientTypeNames = new ObservableCollection<WowClientType>();
            DisplayAddons = new ObservableCollection<AddonListItemViewModel>();
            LoadItemsCommand = new Command(async () => await LoadItems());
            RefreshCommand = new Command(async () => await LoadItems());
            RescanCommand = new Command(async () => await ReScan());
            UpdateAllCommand = new Command(async () => await UpdateAll());
            SelectedWowClientCommand = new Command(async () => await OnSelectedWowClientChanged(SelectedClientType));
            GridSortingCommand = new Command((args) => OnGridSorting(args as DataGridSortingEventArgs));
            ViewInitializedCommand = new Command(() => OnViewInitialized());

            SearchInputViewModel = serviceProvider.GetService<SearchInputViewModel>();
            SearchInputViewModel.TextChanged += SearchInputViewModel_TextChanged;
            SearchInputViewModel.Searched += SearchInputViewModel_Searched;

            BindingOperations.EnableCollectionSynchronization(ClientTypeNames, ClientNamesLock);
            BindingOperations.EnableCollectionSynchronization(DisplayAddons, DisplayAddonsLock);

            SelectedClientType = _sessionService.SelectedClientType;

            SetClientNames();

            Initialize();
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
                EnableUpdateAll = DisplayAddons.Any(addon => addon.CanUpdate || addon.CanInstall);
                EnableRefresh = true;
                EnableRescan = true;
                IsBusy = false;
            }
        }

        private async void UpdateAutoUpdateAddons()
        {
            EnableUpdateAll = false;
            EnableRefresh = false;
            EnableRescan = false;
            IsBusy = true;

            try
            {
                await DisplayAddons.ToList()
                    .Where(addon => addon.IsAutoUpdated && (addon.CanUpdate || addon.CanInstall))
                    .ForEachAsync(2, async addon =>
                    {
                        await addon.UpdateAddon();
                    });
            }
            finally
            {
                EnableUpdateAll = DisplayAddons.Any(addon => addon.CanUpdate || addon.CanInstall);
                EnableRefresh = true;
                EnableRescan = true;
                IsBusy = false;
            }
        }

        private async Task ReScan()
        {
            var messageBoxResult = MessageBox.Show(
                "Doing a re-scan will reset the addon information and attempt to re-guess what you have installed. This operation can take a moment.",
                "Start re-scan?",
                MessageBoxButton.YesNo);

            if (messageBoxResult != MessageBoxResult.Yes)
            {
                return;
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

            try
            {
                _addons = await _addonService.GetAddons(SelectedClientType, forceReload);
                _addons = _addons.OrderBy(addon => addon.GetDisplayState())
                    .ThenBy(addon => addon.Name)
                    .ToList();

                var listViewItems = CreateListViewModels(_addons);

                UpdateDisplayAddons(listViewItems);

                UpdateAutoUpdateAddons();
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
                if (DisplayAddons.Any(da => da.Addon.Id == addon.Id))
                {
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
            if (IsBusy)
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
