using System.Windows.Controls;
using WowUp.WPF.ViewModels;

namespace WowUp.WPF.Views
{
    /// <summary>
    /// Interaction logic for OptionsView.xaml
    /// </summary>
    public partial class OptionsView : UserControl
    {
        private readonly OptionsViewModel _viewModel;

        public OptionsView(OptionsViewModel viewModel)
        {
            DataContext = _viewModel = viewModel;

            InitializeComponent();
        }

        private void SelectLocationButton_Click(object sender, System.Windows.RoutedEventArgs e)
        {
            _viewModel.SetWowLocation();
        }
    }
}
