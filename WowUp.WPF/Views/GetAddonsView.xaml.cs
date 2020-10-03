using System;
using System.Windows.Controls;
using WowUp.WPF.ViewModels;

namespace WowUp.WPF.Views
{
    /// <summary>
    /// Interaction logic for GetAddonsView.xaml
    /// </summary>
    public partial class GetAddonsView : UserControl
    {
        private readonly GetAddonsViewModel _viewModel;

        public GetAddonsView(GetAddonsViewModel viewModel)
        {
            DataContext = _viewModel = viewModel;

            InitializeComponent();
        }

        protected override void OnInitialized(EventArgs e)
        {
            base.OnInitialized(e);
            _viewModel.OnInitialized();
        }
    }
}
