using System.ComponentModel;
using WowUp.Services;
using Xamarin.Forms;

namespace WowUp.Views
{
    // Learn more about making custom code visible in the Xamarin.Forms previewer
    // by visiting https://aka.ms/xamarinforms-previewer
    [DesignTimeVisible(false)]
    public partial class MainPage : TabbedPage
    {
        private readonly IWarcraftService _warcraftService = DependencyService.Get<IWarcraftService>();

        public MainPage()
        {
            InitializeComponent();
        }

        protected override void OnAppearing()
        {
            base.OnAppearing();

            ValidateWowFolderSelected();
        }

        private async void ValidateWowFolderSelected()
        {
            var wowFolder = await _warcraftService.GetWowFolderPath();

            if (!string.IsNullOrEmpty(wowFolder))
            {
                return;
            }

            //MainThread.BeginInvokeOnMainThread(async () =>
            //{
            //    try
            //    {
            //        await Rg.Plugins.Popup.Services.PopupNavigation.Instance.PushAsync(new WowLocationSelectPopupPage());
            //    }
            //    catch(Exception ex)
            //    {
            //        //
            //    }
            //});

        }
    }
}