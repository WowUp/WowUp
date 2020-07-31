using System;
using System.Collections.ObjectModel;
using System.Diagnostics;
using System.Threading.Tasks;

using Xamarin.Forms;

using WowUp.Models;
using WowUp.Views;
using WowUp.Services;
using System.Linq;

namespace WowUp.ViewModels
{
    public class ItemsViewModel : BaseViewModel
    {
        private readonly IAddonService _addonService = DependencyService.Get<IAddonService>();

        private int _selectedWowIndex = 0;

        private bool _forceReload = false;
        public bool ForceReload {
            get => _forceReload;
            set { SetProperty(ref _forceReload, value); }
        }

        public bool ShowEmptyLabel => !IsBusy && DisplayAddons.Count == 0;

        private bool _showResults;
        public bool ShowResults
        {
            get => _showResults;
            set { SetProperty(ref _showResults, value); }
        }
        
        public int SelectedWowIndex
        {
            get => _selectedWowIndex;
            set
            {
                _selectedWowIndex = value;
                OnPropertyChanged(nameof(SelectedWowIndex));
            }
        }

        public string SelectedWowType => WowTypes == null ? string.Empty : WowTypes[SelectedWowIndex];
        private bool IsRetailSelected => SelectedWowIndex == 0;

        public ObservableCollection<string> WowTypes { get; set; }
        public ObservableCollection<Item> Items { get; set; }
        public ObservableCollection<AddonListItemViewModel> DisplayAddons { get; set; }
        public Command LoadItemsCommand { get; set; }
        public Command RefreshCommand { get; set; }

        public ItemsViewModel()
        {
            Title = "My Addons";
            WowTypes = new ObservableCollection<string>() { "Retail", "Classic" };
            Items = new ObservableCollection<Item>();
            DisplayAddons = new ObservableCollection<AddonListItemViewModel>();
            LoadItemsCommand = new Command(async () => await ExecuteLoadItemsCommand());
            ShowResults = false;

            MessagingCenter.Subscribe<NewItemPage, Item>(this, "AddItem", async (obj, item) =>
            {
                var newItem = item as Item;
                Items.Add(newItem);
                await DataStore.AddItemAsync(newItem);
            });
        }

        public async Task ExecuteLoadItemsCommand()
        {
            IsBusy = true;
            ShowResults = false;
            OnPropertyChanged(nameof(ShowEmptyLabel));

            try
            {
                DisplayAddons.Clear();

                var wowType = IsRetailSelected
                    ? WowClientType.Retail
                    : WowClientType.Classic;

                var addons = await _addonService.GetAddons(wowType, ForceReload);
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
                ForceReload = false;
                ShowResults = DisplayAddons.Count > 0;
                OnPropertyChanged(nameof(ShowEmptyLabel));
            }
        }
    }
}