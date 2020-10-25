﻿using System.Windows.Controls;
using WowUp.WPF.Extensions;
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
    }
}
