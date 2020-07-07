using System;
using System.Windows;
using WowUp.WPF.ViewModels;

namespace WowUp.WPF
{
    /// <summary>
    /// Interaction logic for MainWindow.xaml
    /// </summary>
    public partial class MainWindow : Window
    {
        private MainWindowViewModel _viewModel;

        public MainWindow(
            IServiceProvider serviceProvider,
            MainWindowViewModel viewModel)
        {
            DataContext = _viewModel = viewModel;

            InitializeComponent();

            _viewModel.Title = "WowUp.io";

            //var addonsTab = new TabItem
            //{
            //    Name = "Addons",
            //    Header = "My Addons",
            //    Style = Resources["CustomTabItemStyle"] as Style,
            //    Content = serviceProvider.GetService<AddonsView>()
            //};

            //var aboutTab = new TabItem
            //{
            //    Name = "About",
            //    Header = "About",
            //    Style = Resources["CustomTabItemStyle"] as Style,
            //    Content = serviceProvider.GetService<AboutView>()
            //};

            //var optionsTab = new TabItem
            //{
            //    Name = "Options",
            //    Header = "Options",
            //    Style = Resources["CustomTabItemStyle"] as Style,
            //    Content = serviceProvider.GetService<OptionsView>()
            //};

            //Tabs.Items.Add(addonsTab);
            //Tabs.Items.Add(aboutTab);
            //Tabs.Items.Add(optionsTab);
        }

        protected override void OnContentRendered(EventArgs e)
        {
            base.OnContentRendered(e);
            _viewModel.SetRestoreMaximizeVisibility(WindowState);
        }

        private void MinimizeButton_Click(object sender, RoutedEventArgs e)
        {
            WindowState = WindowState.Minimized;
        }

        private void CloseButton_Click(object sender, RoutedEventArgs e)
        {
            Close();
        }

        private void MaximizeRestoreButton_Click(object sender, RoutedEventArgs e)
        {
            if (WindowState == WindowState.Maximized)
            {
                WindowState = WindowState.Normal;
            }
            else
            {
                WindowState = WindowState.Maximized;
            }
        }

        private void Window_StateChanged(object sender, EventArgs e)
        {
            _viewModel.SetRestoreMaximizeVisibility(WindowState);
        }

        private void SelectWowButton_Click(object sender, RoutedEventArgs e)
        {
            _viewModel.SelectWowCommand.Execute(this);
        }

        private void DownloadUpdateButton_Click(object sender, RoutedEventArgs e)
        {
            _viewModel.DownloadLatestVersionCommand.Execute(this);
        }
    }
}
