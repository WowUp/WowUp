using System;
using System.ComponentModel;
using Xamarin.Forms;

using WowUp.Models;
using WowUp.ViewModels;

namespace WowUp.Views
{
    // Learn more about making custom code visible in the Xamarin.Forms previewer
    // by visiting https://aka.ms/xamarinforms-previewer
    [DesignTimeVisible(false)]
    public partial class ItemsPage : ContentPage
    {
        ItemsViewModel viewModel;

        public ItemsPage()
        {
            InitializeComponent();

            BindingContext = viewModel = new ItemsViewModel();
        }

        async void OnItemSelected(object sender, EventArgs args)
        {
            var layout = (BindableObject)sender;
            var item = (Item)layout.BindingContext;
            await Navigation.PushAsync(new ItemDetailPage(new ItemDetailViewModel(item)));
        }

        async void AddItem_Clicked(object sender, EventArgs e)
        {
            await Navigation.PushModalAsync(new NavigationPage(new NewItemPage()));
        }

        protected override void OnAppearing()
        {
            base.OnAppearing();

            viewModel.SelectedWowIndex = 0;
        }

        private void WowTypePicker_SelectedIndexChanged(object sender, EventArgs e)
        {
            viewModel.IsBusy = true;
            viewModel.LoadItemsCommand.Execute(this);
        }

        private void RefreshButton_Clicked(object sender, EventArgs e)
        {
            viewModel.IsBusy = true;
        }

        private void RescanButton_Clicked(object sender, EventArgs e)
        {
            viewModel.ForceReload = true;
            viewModel.IsBusy = true;
        }
    }
}