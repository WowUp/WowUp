using System;
using System.ComponentModel;
using System.Windows;
using System.Windows.Forms;
using WowUp.WPF.Services.Contracts;
using WowUp.WPF.ViewModels;

namespace WowUp.WPF
{
    /// <summary>
    /// Interaction logic for MainWindow.xaml
    /// </summary>
    public partial class MainWindow : Window
    {
        private readonly MainWindowViewModel _viewModel;
        private readonly NotifyIcon _notifyIcon;

        public MainWindow(
            IAnalyticsService analyticsService,
            MainWindowViewModel viewModel)
        {
            _notifyIcon = CreateNotifyIcon();

            DataContext = _viewModel = viewModel;

            InitializeComponent();

            _viewModel.Title = "WowUp.io";
        }

        protected override void OnContentRendered(EventArgs e)
        {
            base.OnContentRendered(e);
            _viewModel.SetRestoreMaximizeVisibility(WindowState);
        }

        protected override void OnSourceInitialized(EventArgs e)
        {
            base.OnSourceInitialized(e);
            _viewModel.OnSourceInitialized(this);
        }

        protected override void OnClosed(EventArgs e)
        {
            base.OnClosed(e);
        }

        protected override void OnClosing(CancelEventArgs e)
        {
            base.OnClosing(e);
            _viewModel.OnClosing(this);
        }

        private NotifyIcon CreateNotifyIcon()
        {
            var iconStream = System.Windows.Application.GetResourceStream(new Uri("pack://application:,,,/WowUp;component/Assets/wowup_logo_512np_RRT_icon.ico")).Stream;
            var icon = new System.Drawing.Icon(iconStream);
            var image = System.Drawing.Image.FromStream(iconStream);

            var contextMenu = new ContextMenuStrip();
            contextMenu.Items.Add(new ToolStripLabel("WowUp", image));
            contextMenu.Items.Add("Close", null, this.NotifyIcon_Close_Click);

            var notifyIcon = new NotifyIcon();
            notifyIcon.BalloonTipText = "The app has been minimised. Click the tray icon to show.";
            notifyIcon.BalloonTipTitle = "WowUp";
            notifyIcon.Text = "WowUp";

            notifyIcon.Icon = icon;
            notifyIcon.Click += new EventHandler(NotifyIcon_Click);

            notifyIcon.ContextMenuStrip = contextMenu;

            notifyIcon.Visible = true;

            return notifyIcon;
        }

        private void MinimizeButton_Click(object sender, RoutedEventArgs e)
        {
            WindowState = WindowState.Minimized;
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

        private void Window_IsVisibleChanged(object sender, DependencyPropertyChangedEventArgs e)
        {
        }

        private void NotifyIcon_Click(object sender, EventArgs e)
        {
            if (e is MouseEventArgs mouseEvt)
            {
                if( mouseEvt.Button == System.Windows.Forms.MouseButtons.Left)
                {
                    Show();
                    WindowState = WindowState.Normal;
                    Activate();
                }
            }
        }

        private void NotifyIcon_Close_Click(object sender, EventArgs e)
        {
            Close();
        }

        private void Window_Loaded(object sender, RoutedEventArgs e)
        {
            _viewModel.OnLoaded();
        }
    }
}
