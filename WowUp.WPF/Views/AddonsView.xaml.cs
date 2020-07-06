using System.Windows.Controls;
using WowUp.WPF.ViewModels;

namespace WowUp.WPF.Views
{
    /// <summary>
    /// Interaction logic for AddonsView.xaml
    /// </summary>
    public partial class AddonsView : UserControl
    {
        private AddonsViewViewModel _viewModel;

        public AddonsView(AddonsViewViewModel viewModel)
        {
            DataContext = _viewModel = viewModel;
            InitializeComponent();

            _viewModel.SelectedWowIndex = 0;
        }

        private void ComboBox_SelectionChanged(object sender, SelectionChangedEventArgs e)
        {
            _viewModel.LoadItemsCommand.Execute(this);
        }

        private void RescanButton_Click(object sender, System.Windows.RoutedEventArgs e)
        {
            _viewModel.RescanCommand.Execute(this);
        }

        private void RefreshButton_Click(object sender, System.Windows.RoutedEventArgs e)
        {
            _viewModel.RefreshCommand.Execute(this);
        }

        private void UpdateAllButton_Click(object sender, System.Windows.RoutedEventArgs e)
        {
            _viewModel.UpdateAllCommand.Execute(this);
        }
    }
}
