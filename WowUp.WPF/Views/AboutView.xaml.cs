using System.Diagnostics;
using System.Windows.Controls;
using WowUp.WPF.ViewModels;

namespace WowUp.WPF.Views
{
    /// <summary>
    /// Interaction logic for AboutView.xaml
    /// </summary>
    public partial class AboutView : UserControl
    {
        private readonly AboutViewModel _viewModel;

        public AboutView(AboutViewModel viewModel)
        {
            DataContext = _viewModel = viewModel;

            InitializeComponent();
        }

        private void WowupLink_RequestNavigate(object sender, System.Windows.Navigation.RequestNavigateEventArgs e)
        {
            Process.Start(new ProcessStartInfo(e.Uri.AbsoluteUri) { UseShellExecute = true });
            e.Handled = true;
        }
    }
}
