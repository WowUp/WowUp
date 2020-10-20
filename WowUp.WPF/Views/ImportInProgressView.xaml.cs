using System;
using System.ComponentModel;
using System.Windows;
using System.Windows.Controls;
using WowUp.WPF.ViewModels;

namespace WowUp.WPF.Views
{
    /// <summary>
    /// Interaction logic for InstallUrlWindow.xaml
    /// </summary>
    public partial class ImportInProgressView : Window
    {
        private readonly ImportInProgressViewModel _viewModel;

        public ImportInProgressView(ImportInProgressViewModel viewModel)
        {
            DataContext = _viewModel = viewModel;
            _viewModel.Window = this;

            InitializeComponent();
        }
        private void ProgressTextBox_OnTextChanged(object sender, TextChangedEventArgs e)
        {
            ProgressTextBox.ScrollToEnd();
        }

        private void CloseClicked(object sender, RoutedEventArgs e)
        {
            this.Close();
        }
    }
}