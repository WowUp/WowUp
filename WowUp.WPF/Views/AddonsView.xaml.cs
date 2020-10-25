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

        // The command binder in XAML didnt want to forward me the event :(
        private void AddonGrid_Sorting(object sender, DataGridSortingEventArgs e)
        {
            _viewModel.GridSortingCommand.Execute(e);
        }

        private void UserControl_Initialized(object sender, System.EventArgs e)
        {
            _viewModel.ViewInitializedCommand.Execute(e);
        }
    }
}
