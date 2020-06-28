namespace WowUp.ViewModels
{
    public class OptionsPageViewModel : BaseViewModel
    {
        private string _retailPath = string.Empty;
        private string _classicPath = string.Empty;

        public string RetailPath
        {
            get => _retailPath;
            set
            {
                _retailPath = value;
                OnPropertyChanged(nameof(RetailPath));
            }
        }

        public string ClassicPath
        {
            get => _classicPath;
            set
            {
                _classicPath = value;
                OnPropertyChanged(nameof(ClassicPath));
            }
        }

        public OptionsPageViewModel()
        {
            Title = "Options";
        }
    }
}
