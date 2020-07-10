using System.Windows;
using WowUp.WPF.ViewModels;

namespace WowUp.WPF.Views
{
    /// <summary>
    /// Interaction logic for InstallUrlWindow.xaml
    /// </summary>
    public partial class InstallUrlWindow : Window
    {
        private readonly InstallUrlDialogViewModel _viewModel;


        public InstallUrlWindow(InstallUrlDialogViewModel viewModel)
        {
            DataContext = _viewModel = viewModel;
            _viewModel.Window = this;

            InitializeComponent();
        }

    }
}
