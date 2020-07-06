using System;
using System.Collections.ObjectModel;
using System.Diagnostics;
using System.Linq;
using System.Threading.Tasks;
using WowUp.WPF.Extensions;
using WowUp.WPF.Models;
using WowUp.WPF.Services;
using WowUp.WPF.Services.Contracts;
using WowUp.WPF.Utilities;
using Microsoft.Extensions.DependencyInjection;
using Serilog;

namespace WowUp.WPF.ViewModels
{
    public class AddonsViewViewModel : BaseViewModel
    {
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

        private bool IsRetailSelected => SelectedWowIndex == 0;

        public Command LoadItemsCommand { get; set; }
        public Command RefreshCommand { get; set; }
        public Command RescanCommand { get; set; }
        public Command UpdateAllCommand { get; set; }

        public ObservableCollection<AddonListItemViewModel> DisplayAddons { get; set; }

        public AddonsViewViewModel(
            IServiceProvider serviceProvider,
            IAddonService addonService,
            IWarcraftService warcraftService)
        {
            _addonService = addonService;
            _warcraftService = warcraftService;
            _serviceProvider = serviceProvider;

            DisplayAddons = new ObservableCollection<AddonListItemViewModel>();
            LoadItemsCommand = new Command(async () => await LoadItems());
            RefreshCommand = new Command(async () => await LoadItems());
            RescanCommand = new Command(async () => await LoadItems(true));
            UpdateAllCommand = new Command(async () => await UpdateAll());
        }

        public async Task UpdateAll()
        {
            EnableUpdateAll = false;

            await DisplayAddons
                .Where(addon => addon.CanUpdate || addon.CanInstall)
                .ForEachAsync(2, async addon =>
                {
                    await addon.InstallAddon();
                });

            EnableUpdateAll = true;
        }

        public async Task LoadItems(bool forceReload = false)
        {
            IsBusy = true;
            EnableUpdateAll = false;
            ShowResults = false;
            ShowEmptyLabel = false;

            try
            {
                DisplayAddons.Clear();

                var wowType = IsRetailSelected
                    ? WowClientType.Retail
                    : WowClientType.Classic;

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

                    var viewModel = _serviceProvider.GetService<AddonListItemViewModel>();
                    viewModel.Addon = addon;

                    DisplayAddons.Add(viewModel);
                }
            }
            catch (Exception ex)
            {
                Log.Error(ex, "LoadItems");
                Debug.WriteLine(ex);
            }
            finally
            {
                IsBusy = false;
                ShowResults = DisplayAddons.Any();
                ShowEmptyLabel = !DisplayAddons.Any();
                EnableUpdateAll = DisplayAddons.Any(addon => addon.CanUpdate || addon.CanInstall);
            }
        }
    }
}
