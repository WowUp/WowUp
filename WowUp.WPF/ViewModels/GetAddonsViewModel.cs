using Microsoft.Extensions.DependencyInjection;
using Serilog;
using System;
using System.Collections.Generic;
using System.Collections.ObjectModel;
using System.Threading.Tasks;
using System.Windows;
using System.Windows.Data;
using WowUp.Common.Enums;
using WowUp.Common.Models;
using WowUp.Common.Services.Contracts;
using WowUp.WPF.Services.Contracts;
using WowUp.WPF.Utilities;
using WowUp.WPF.Views;

namespace WowUp.WPF.ViewModels
{
    public class GetAddonsViewModel : BaseViewModel
    {
        private static readonly object ClientNamesLock = new object();
        private static readonly object DisplayAddonsLock = new object();

        private readonly IAddonService _addonService;
        private readonly IServiceProvider _serviceProvider;
        private readonly ISessionService _sessionService;
        private readonly IWarcraftService _warcraftService;

        private List<PotentialAddon> _popularAddons;

        private string _searchText;
        public string SearchText
        {
            get => _searchText;
            set { SetProperty(ref _searchText, value); }
        }

        private WowClientType _selectedClientType;
        public WowClientType SelectedClientType
        {
            get => _selectedClientType;
            set { SetProperty(ref _selectedClientType, value); }
        }

        public ObservableCollection<PotentialAddonListItemViewModel> DisplayAddons { get; set; }
        public ObservableCollection<WowClientType> ClientTypeNames { get; set; }
        public Command RefreshCommand { get; set; }
        public Command InstallNewCommand { get; set; }
        public Command SelectedWowClientCommand { get; set; }
        public SearchInputViewModel SearchInputViewModel { get; set; }

        public GetAddonsViewModel(
            IServiceProvider serviceProvider,
            IAddonService addonService,
            IWarcraftService warcraftService,
            ISessionService sessionService)
        {
            _addonService = addonService;
            _serviceProvider = serviceProvider;
            _warcraftService = warcraftService;
            _sessionService = sessionService;

            ClientTypeNames = new ObservableCollection<WowClientType>();
            DisplayAddons = new ObservableCollection<PotentialAddonListItemViewModel>();

            RefreshCommand = new Command(() => OnRefresh());
            InstallNewCommand = new Command(() => OnInstallFromUrl());
            SelectedWowClientCommand = new Command(async () => await OnSelectedWowClientChanged(SelectedClientType));

            BindingOperations.EnableCollectionSynchronization(ClientTypeNames, ClientNamesLock);
            BindingOperations.EnableCollectionSynchronization(DisplayAddons, DisplayAddonsLock);

            SearchInputViewModel = serviceProvider.GetService<SearchInputViewModel>();
            SearchInputViewModel.TextChanged += SearchInputViewModel_TextChanged; ;
            SearchInputViewModel.Searched += SearchInputViewModel_Searched; ;

            _addonService.AddonUninstalled += (sender, args) =>
            {
                OnRefresh();
            };

            _addonService.AddonListUpdated += (sender, args) =>
            {
                OnRefresh();
            }; 

            _sessionService.SessionChanged += (sender, args) =>
            {
                SelectedClientType = args.SessionState.SelectedClientType;
            };

            _sessionService.TabChanged += (sender, tabType) =>
            {
                if (tabType != GetType())
                {
                    return;
                }

                OnTabActivated();
            };

            SelectedClientType = _sessionService.SelectedClientType;
        }

        public async void OnInitialized()
        {
            SetClientNames();
            await LoadPopularAddons();
        }

        private void OnTabActivated()
        {
            SetResultCountContextText(DisplayAddons.Count);
        }

        private void SetResultCountContextText(int count)
        {
            _sessionService.SetContextText(this, $"{count} results");
        }

        private void SearchInputViewModel_Searched(object sender, Models.Events.SearchInputEventArgs e)
        {
            OnSearch(e.Text);
        }

        private void SearchInputViewModel_TextChanged(object sender, Models.Events.SearchInputEventArgs e)
        {
            if (string.IsNullOrEmpty(e.Text))
            {
                OnSearch(e.Text);
            }
        }

        private void SetClientNames()
        {
            lock (ClientNamesLock)
            {
                ClientTypeNames.Clear();

                foreach (var clientType in _warcraftService.GetWowClientTypes())
                {
                    ClientTypeNames.Add(clientType);
                }
            }
        }

        private async void OnRefresh()
        {
            if (string.IsNullOrEmpty(SearchText))
            {
                await LoadPopularAddons();
            }
            else
            {
                OnSearch(SearchText);
            }
        }

        public async Task OnSelectedWowClientChanged(WowClientType clientType)
        {
            _sessionService.SelectedClientType = _selectedClientType;
            await LoadPopularAddons();
        }

        private async void OnSearch(string text)
        {
            if (string.IsNullOrEmpty(text))
            {
                await LoadPopularAddons();
                return;
            }

            IsBusy = true;

            var searchResults = await _addonService.Search(
                text, 
                SelectedClientType,
                (ex) =>
                {
                    MessageBox.Show(
                        ex.Message, 
                        "Error", 
                        MessageBoxButton.OK);
                });

            lock (DisplayAddonsLock)
            {
                DisplayAddons.Clear();
                foreach (var result in searchResults)
                {
                    var viewModel = _serviceProvider.GetService<PotentialAddonListItemViewModel>();
                    viewModel.ClientType = SelectedClientType;
                    viewModel.IsInstalled = _addonService.IsInstalled(result.ExternalId, SelectedClientType);
                    viewModel.Addon = result;

                    DisplayAddons.Add(viewModel);
                }
            }

            SetResultCountContextText(DisplayAddons.Count);
            IsBusy = false;
        }

        private void OnInstallFromUrl()
        {
            // Instantiate the dialog box
            var dlg = _serviceProvider.GetService<InstallUrlWindow>();
            (dlg.DataContext as InstallUrlDialogViewModel).ClientType = SelectedClientType;

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
        }

        private async Task LoadPopularAddons()
        {
            IsBusy = true;

            try
            {
                if (SelectedClientType == WowClientType.None)
                {
                    return;
                }

                _popularAddons = await _addonService.GetFeaturedAddons(SelectedClientType);

                lock (DisplayAddonsLock)
                {
                    DisplayAddons.Clear();
                    foreach (var addon in _popularAddons)
                    {
                        if (_addonService.IsInstalled(addon.ExternalId, SelectedClientType))
                        {
                            continue;
                        }

                        var viewModel = _serviceProvider.GetService<PotentialAddonListItemViewModel>();
                        viewModel.Addon = addon;
                        viewModel.ClientType = SelectedClientType;

                        DisplayAddons.Add(viewModel);
                    }
                }

                SetResultCountContextText(DisplayAddons.Count);
            }
            catch (Exception ex) 
            {
                Log.Error(ex, "failed to get popular addons");
            }
            finally
            {
                IsBusy = false;
            }
        }
    }
}
