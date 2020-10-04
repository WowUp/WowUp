using System.Collections;
using System.Collections.Generic;
using System.Linq;
using System.Windows.Controls;
using WowUp.WPF.Extensions;
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

        private void AddonLink_RequestNavigate(object sender, System.Windows.Navigation.RequestNavigateEventArgs e)
        {
            e.Uri.AbsoluteUri.OpenUrlInBrowser();
            e.Handled = true;
        }

        // The command binder in XAML didnt want to forward me the event :(
        private void AddonGrid_Sorting(object sender, DataGridSortingEventArgs e)
        {
            _viewModel.GridSortingCommand.Execute(e);
        }

        private void UserControl_Initialized(object sender, System.EventArgs e)
        {
            _viewModel.MultiRowMenu = (ContextMenu)AddonGrid.Resources["MultiRowMenu"];
            _viewModel.RowMenu = (ContextMenu)AddonGrid.Resources["RowMenu"];
            _viewModel.ViewInitializedCommand.Execute(e);
        }

        private void AddonGrid_SelectionChanged(object sender, SelectionChangedEventArgs e)
        {
            var selectedItems = ((DataGrid)sender).SelectedItems.Cast<AddonListItemViewModel>();
            _viewModel.OnDataGridSelectionChange(selectedItems);
        }
    }
}
