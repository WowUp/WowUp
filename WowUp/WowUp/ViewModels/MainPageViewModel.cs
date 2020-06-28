namespace WowUp.ViewModels
{
    public class MainPageViewModel : BaseViewModel
    {

        private int _selectedTabIndex;
        public int SelectedTabIndex
        {
            get => _selectedTabIndex;
            set { SetProperty(ref _selectedTabIndex, value); }
        }

        public MainPageViewModel() : base()
        {
            SelectedTabIndex = 0;
        }
    }
}
