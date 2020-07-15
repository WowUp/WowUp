using System.Windows;
using WowUp.WPF.Utilities;

namespace WowUp.WPF.ViewModels
{
    public class InstallUrlDialogViewModel : BaseViewModel
    {
        public Window Window { get; set; }

        private string _input;
        public string Input
        {
            get => _input;
            set { SetProperty(ref _input, value); }
        }

        public Command SubmitCommand { get; set; }

        public InstallUrlDialogViewModel()
        {
            SubmitCommand = new Command(() => OnSubmit());
        }

        private void OnSubmit()
        {
            Window.DialogResult = true;
        }
    }
}
