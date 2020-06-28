using System;
using System.Collections.Generic;
using System.Collections.ObjectModel;
using System.Diagnostics;
using System.Linq;
using System.Threading.Tasks;
using WowUp.WPF.Models;
using WowUp.WPF.Services;
using WowUp.WPF.Services.Contracts;
using WowUp.WPF.Utilities;

namespace WowUp.WPF.ViewModels
{
    public class AddonsViewViewModel : BaseViewModel
    {
        private readonly IWarcraftService _warcraftService = WarcraftService.Instance;
        private readonly IAddonService _addonService = AddonService.Instance;

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

        private bool IsRetailSelected => SelectedWowIndex == 0;

        public Command LoadItemsCommand { get; set; }
        public Command RefreshCommand { get; set; }
        public Command RescanCommand { get; set; }

        public ObservableCollection<AddonListItemViewModel> DisplayAddons { get; set; }

        public AddonsViewViewModel()
        {
            DisplayAddons = new ObservableCollection<AddonListItemViewModel>();
            LoadItemsCommand = new Command(async () => await LoadItems());
            RefreshCommand = new Command(async () => await LoadItems());
            RescanCommand = new Command(async () => await LoadItems(true));
        }

        public async Task LoadItems(bool forceReload = false)
        {
            IsBusy = true;
            ShowResults = false;
            ShowEmptyLabel = false;

            try
            {
                DisplayAddons.Clear();

                var wowType = IsRetailSelected
                    ? WowClientType.Retail
                    : WowClientType.Classic;

                var addons = await _addonService.GetAddons(wowType, forceReload);
                addons = addons.OrderBy(addon => addon.Name)
                    .ThenBy(addon => string.IsNullOrEmpty(addon.InstalledVersion))
                    .ToList();

                foreach (var addon in addons)
                {
                    if (string.IsNullOrEmpty(addon.LatestVersion))
                    {
                        continue;
                    }

                    DisplayAddons.Add(new AddonListItemViewModel(addon));
                }
            }
            catch (Exception ex)
            {
                Debug.WriteLine(ex);
            }
            finally
            {
                IsBusy = false;
                ShowResults = DisplayAddons.Any();
                ShowEmptyLabel = !DisplayAddons.Any();
            }
        }
    }
}
