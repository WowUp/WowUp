using System;
using System.Collections.ObjectModel;
using System.Linq;
using System.Threading.Tasks;
using WowUp.WPF.Extensions;
using WowUp.WPF.Services.Contracts;
using WowUp.WPF.Utilities;
using Microsoft.Extensions.DependencyInjection;
using Serilog;
using System.Windows.Controls;
using System.Collections.Generic;
using WowUp.WPF.Views;
using System.Windows;
using WowUp.WPF.Errors;
using WowUp.Common.Enums;
using System.Windows.Data;
using WowUp.WPF.Entities;

namespace WowUp.WPF.ViewModels
{
    public class AddonsViewViewModel : BaseViewModel
    {
        private static readonly object ClientNamesLock = new object();
        private static readonly object DisplayAddonsLock = new object();
        private static readonly object LoadLock = new object();

        private readonly IServiceProvider _serviceProvider;
        private readonly IWarcraftService _warcraftService;
        private readonly IAddonService _addonService;

        private int _selectedWowIndex = 0;
        public int SelectedWowIndex
        {
            get => _selectedWowIndex;
            set { SetProperty(ref _selectedWowIndex, value); }
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

        private AddonListItemViewModel _selectedRow;
        public AddonListItemViewModel SelectedRow
        {
            get => _selectedRow;
            set { SetProperty(ref _selectedRow, value); }
        }

        private IList<WowClientType> _clientTypes = new List<WowClientType>();
        private IList<string> _clientNames = new List<string>();

        public Command LoadItemsCommand { get; set; }
        public Command RefreshCommand { get; set; }
        public Command RescanCommand { get; set; }
        public Command UpdateAllCommand { get; set; }
        public Command InstallCommand { get; set; }

        public ObservableCollection<ComboBoxItem> ClientNames { get; set; }
        public ObservableCollection<AddonListItemViewModel> DisplayAddons { get; set; }

        public WowClientType SelectedClientType => _clientTypes[SelectedWowIndex];

        public AddonsViewViewModel(
            IServiceProvider serviceProvider,
            IAddonService addonService,
            IWarcraftService warcraftService)
        {
            _addonService = addonService;
            _warcraftService = warcraftService;
            _serviceProvider = serviceProvider;

            _addonService.AddonInstalled += (sender, args) =>
            {
                AddAddonListItem(args.Addon);
            };

            _addonService.AddonUninstalled += (sender, args) =>
            {
                RemoveAddonListItem(args.Addon);
            };

            _warcraftService.ProductChanged += (sender, args) =>
            {
                SetClientNames();
            };

            Initialize();
        }

        public void Initialize()
        {
            ClientNames = new ObservableCollection<ComboBoxItem>();
            DisplayAddons = new ObservableCollection<AddonListItemViewModel>();
            LoadItemsCommand = new Command(async () => await LoadItems());
            RefreshCommand = new Command(async () => await LoadItems());
            RescanCommand = new Command(async () => await LoadItems(true));
            UpdateAllCommand = new Command(async () => await UpdateAll());
            InstallCommand = new Command(async () => await InstallNewAddon());

            BindingOperations.EnableCollectionSynchronization(ClientNames, ClientNamesLock);
            BindingOperations.EnableCollectionSynchronization(DisplayAddons, DisplayAddonsLock);

            SetClientNames();
        }

        private void SetClientNames()
        {
            ClientNames.Clear();

            _clientTypes = _warcraftService.GetWowClientTypes();
            _clientNames = _warcraftService.GetWowClientNames();

            for (var i = 0; i < _clientNames.Count; i += 1)
            {
                var clientName = _clientNames[i];
                ClientNames.Add(new ComboBoxItem
                {
                    Content = clientName
                });
            }

            SelectedWowIndex = 0;
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
                EnableUpdateAll = true;
                EnableRefresh = true;
                EnableRescan = true;
                IsBusy = false;
            }
        }

        private async Task InstallNewAddon()
        {
            // Instantiate the dialog box
            var dlg = _serviceProvider.GetService<InstallUrlWindow>();

            // Configure the dialog box
            dlg.Owner = Application.Current.MainWindow;

            // Open the dialog box modally
            if (dlg.ShowDialog() == false)
            {
                return;
            }

            var result = (dlg.DataContext as InstallUrlDialogViewModel).Input;
            if (string.IsNullOrEmpty(result))
            {
                return;
            }

            Uri uri;
            try
            {
                uri = new Uri(result);
            }
            catch (Exception)
            {
                MessageBox.Show("Input was not a valid URL.");
                return;
            }

            try
            {
                await _addonService.InstallAddon(uri, SelectedClientType);
            }
            catch (AddonNotFoundException)
            {
                MessageBox.Show("Addon not found");
            }
            catch (AddonAlreadyInstalledException)
            {
                MessageBox.Show("Addon already installed");
            }

            await LoadItems();
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
                var listViewItems = new List<AddonListItemViewModel>();
                var wowType = _clientTypes[SelectedWowIndex];

                var addons = await _addonService.GetAddons(wowType, forceReload);
                addons = addons.OrderBy(addon => addon.GetDisplayState())
                    .ThenBy(addon => addon.Name)
                    .ToList();

                foreach (var addon in addons)
                {
                    if (string.IsNullOrEmpty(addon.LatestVersion))
                    {
                        continue;
                    }

                    var viewModel = GetAddonViewModel(addon);

                    listViewItems.Add(viewModel);
                }

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

        private AddonListItemViewModel GetAddonViewModel(Addon addon)
        {
            var viewModel = _serviceProvider.GetService<AddonListItemViewModel>();
            viewModel.Addon = addon;

            return viewModel;
        }

        private void AddAddonListItem(Addon addon)
        {
            lock (LoadLock)
            {
                var viewModel = GetAddonViewModel(addon);

                DisplayAddons.Add(viewModel);
            }
        }

        private void RemoveAddonListItem(Addon addon)
        {
            lock (LoadLock)
            {
                DisplayAddons.Remove(DisplayAddons.First(da => addon.Id == da.Addon.Id));
            }
        }

        private void UpdateDisplayAddons(IList<AddonListItemViewModel> addons)
        {
            lock (LoadLock)
            {
                DisplayAddons.Clear();

                for(var i = 0; i < addons.Count(); i += 1)
                {
                    DisplayAddons.Add(addons[i]);
                }
            }
        }

        public class ComboData
        {
            public int Id { get; set; }
            public string Value { get; set; }
        }
    }
}
