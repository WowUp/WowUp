using Microsoft.Extensions.DependencyInjection;
using System;
using System.Collections.Generic;
using System.Collections.ObjectModel;
using System.Linq;
using System.Threading.Tasks;
using System.Windows.Controls;
using WowUp.WPF.Extensions;
using WowUp.WPF.Models;
using WowUp.WPF.Services.Contracts;
using WowUp.WPF.Utilities;

namespace WowUp.WPF.ViewModels
{
    public class GetAddonsViewModel : BaseViewModel
    {
        private readonly IServiceProvider _serviceProvider;
        private readonly IAddonService _addonService;
        private readonly IWarcraftService _warcraftService;

        private IList<WowClientType> _clientTypes;
        private IList<string> _clientNames;

        private List<PotentialAddon> _popularAddons;

        private int _selectedWowIndex = 0;
        public int SelectedWowIndex
        {
            get => _selectedWowIndex;
            set { 
                SetProperty(ref _selectedWowIndex, value);
                OnSelectedWowChange();
            }
        }

        public WowClientType SelectedClientType => _clientTypes[SelectedWowIndex];

        public ObservableCollection<PotentialAddonListItemViewModel> DisplayAddons { get; set; }
        public ObservableCollection<ComboBoxItem> ClientNames { get; set; }
        public Command RefreshCommand { get; set; }
        public Command SearchCommand { get; set; }

        public GetAddonsViewModel(
            IServiceProvider serviceProvider,
            IAddonService addonService,
            IWarcraftService warcraftService)
        {
            _addonService = addonService;
            _serviceProvider = serviceProvider;
            _warcraftService = warcraftService;

            _clientTypes = new List<WowClientType>();
            _clientNames = new List<string>();

            ClientNames = new ObservableCollection<ComboBoxItem>();
            DisplayAddons = new ObservableCollection<PotentialAddonListItemViewModel>();

            RefreshCommand = new Command(() => OnRefresh());
            SearchCommand = new Command((text) => OnSearch((string)text));
        }

        public async void OnInitialized()
        {
            _clientTypes = await _warcraftService.GetWowClients();
            _clientNames = await _warcraftService.GetWowClientNames();

            for (var i = 0; i < _clientNames.Count; i += 1)
            {
                var clientName = _clientNames[i];
                ClientNames.Add(new ComboBoxItem
                {
                    Content = clientName
                });
            }

            await LoadPopularAddons();
        }

        private async void OnRefresh()
        {
            await LoadPopularAddons();
        }

        private async void OnSearch(string text)
        {
            System.Windows.MessageBox.Show("Search Coming Soon");
        }

        private async void OnSelectedWowChange()
        {
            await LoadPopularAddons();
        }

        private async Task LoadPopularAddons()
        {
            IsBusy = true;

            _popularAddons = await _addonService.GetFeaturedAddons(SelectedClientType);
            _popularAddons = _popularAddons
                .Where(addon => !_addonService.IsInstalled(addon.ExternalId, SelectedClientType))
                .ToList();

            DisplayAddons.Clear();
            foreach (var addon in _popularAddons)
            {
                var viewModel = _serviceProvider.GetService<PotentialAddonListItemViewModel>();
                viewModel.Addon = addon;
                viewModel.ClientType = SelectedClientType;

                DisplayAddons.Add(viewModel);
            }

            IsBusy = false;
        }
    }
}
