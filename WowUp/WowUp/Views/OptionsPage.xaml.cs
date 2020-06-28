using System;
using WowUp.Services;
using WowUp.ViewModels;
using Xamarin.Forms;
using Xamarin.Forms.Xaml;

namespace WowUp.Views
{
    [XamlCompilation(XamlCompilationOptions.Compile)]
    public partial class OptionsPage : ContentPage
    {
        private readonly IWarcraftService _warcraftService = DependencyService.Get<IWarcraftService>();


        private OptionsPageViewModel _viewModel;


        public OptionsPage()
        {
            InitializeComponent();

            BindingContext = _viewModel = new OptionsPageViewModel();
        }

        protected override void OnAppearing()
        {
            base.OnAppearing();

            LoadWowData();
        }

        private async void LoadWowData()
        {
            _viewModel.RetailPath = await _warcraftService.GetRetailFolderPath();
            _viewModel.ClassicPath = await _warcraftService.GetClassicFolderPath();
        }

        private void Button_Clicked(object sender, EventArgs e)
        {

        }
    }
}