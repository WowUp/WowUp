using System.Windows.Controls;
using System.Windows.Media;
using WowUp.WPF.ViewModels;

namespace WowUp.WPF.Views
{
    /// <summary>
    /// Interaction logic for AddonsView.xaml
    /// </summary>
    public partial class AddonsView : UserControl
    {
        private AddonsViewViewModel viewModel;

        public AddonsView()
        {
            DataContext = viewModel = new AddonsViewViewModel();
            InitializeComponent();

            viewModel.SelectedWowIndex = 0;
        }

        private void ComboBox_SelectionChanged(object sender, SelectionChangedEventArgs e)
        {
            viewModel.LoadItemsCommand.Execute(this);
        }

        private void RescanButton_Click(object sender, System.Windows.RoutedEventArgs e)
        {
            viewModel.RescanCommand.Execute(this);
        }

        private void RefreshButton_Click(object sender, System.Windows.RoutedEventArgs e)
        {
            viewModel.RefreshCommand.Execute(this);
        }
    }
}
