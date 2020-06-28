using Xamarin.Forms;
using WowUp.Services;
using WowUp.Views;

namespace WowUp
{
    public partial class App : Application
    {

        public App()
        {
            InitializeComponent();

            DependencyService.Register<MockDataStore>();
            DependencyService.Register<AddonDataStore>();
            MainPage = new MainPage();
        }

        protected override void OnStart()
        {
           

        }

        protected override void OnSleep()
        {
        }

        protected override void OnResume()
        {
        }
    }
}
