namespace WowUp.WPF.ViewModels
{
    public class AboutViewModel : BaseViewModel
    {
        private string _version;
        public string Version
        {
            get => _version;
            set { SetProperty(ref _version, value); }
        }

        public AboutViewModel()
        {
            Version = "v" + GetType().Assembly.GetName().Version.ToString();
        }
    }
}
