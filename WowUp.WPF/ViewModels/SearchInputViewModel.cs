using WowUp.WPF.Models.Events;
using WowUp.WPF.Utilities;

namespace WowUp.WPF.ViewModels
{
    public delegate void SearchEventHandler(object sender, SearchInputEventArgs e);

    public class SearchInputViewModel : BaseViewModel
    {
        public event SearchEventHandler TextChanged;
        public event SearchEventHandler Searched;

        private string _inputText;
        public string InputText
        {
            get => _inputText;
            set { SetProperty(ref _inputText, value); }
        }

        private bool _showIcon;
        public bool ShowIcon
        {
            get => _showIcon;
            set { SetProperty(ref _showIcon, value); }
        }

        public Command TextChangedCommand { get; set; }
        public Command SearchCommand { get; set; }
        public Command ClearCommand { get; set; }

        public SearchInputViewModel()
        {
            InputText = string.Empty;
            ShowIcon = string.IsNullOrEmpty(InputText);
            TextChangedCommand = new Command((text) => OnTextChanged((string)text));
            SearchCommand = new Command((text) => OnSearch((string)text));
            ClearCommand = new Command((text) => OnClear());
        }

        private void OnClear()
        {
            InputText = string.Empty;
            ShowIcon = string.IsNullOrEmpty(InputText);
        }

        private void OnTextChanged(string text)
        {
            ShowIcon = string.IsNullOrEmpty(text);
            TextChanged?.Invoke(this, new SearchInputEventArgs(InputText));
        }

        private void OnSearch(string text)
        {
            Searched?.Invoke(this, new SearchInputEventArgs(text));
        }
    }
}
