using System;
using System.ComponentModel;
using System.Runtime.InteropServices;
using System.Windows;
using System.Windows.Forms;
using System.Windows.Interop;
using WowUp.WPF.Extensions;
using WowUp.WPF.Services.Contracts;
using WowUp.WPF.ViewModels;
using static WowUp.WPF.Utilities.WindowUtilities;

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

        public override void OnApplyTemplate()
        {
            base.OnApplyTemplate();
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

            var handle = (new WindowInteropHelper(this)).Handle;
            var handleSource = HwndSource.FromHwnd(handle);
            if (handleSource == null)
                return;
            handleSource.AddHook(WindowProc);
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

        private static IntPtr WindowProc(IntPtr hwnd, int msg, IntPtr wParam, IntPtr lParam, ref bool handled)
        {
            switch (msg)
            {
                case 0x0024:/* WM_GETMINMAXINFO */
                    WmGetMinMaxInfo(hwnd, lParam);
                    handled = true;
                    break;
            }

            return (IntPtr)0;
        }

        private static void WmGetMinMaxInfo(IntPtr hwnd, IntPtr lParam)
        {
            var mmi = (MINMAXINFO)Marshal.PtrToStructure(lParam, typeof(MINMAXINFO));

            // Adjust the maximized size and position to fit the work area of the correct monitor
            var currentScreen = Screen.FromHandle(hwnd);
            var workArea = currentScreen.WorkingArea;
            var monitorArea = currentScreen.Bounds;
            mmi.ptMaxPosition.X = Math.Abs(workArea.Left - monitorArea.Left);
            mmi.ptMaxPosition.Y = Math.Abs(workArea.Top - monitorArea.Top);
            mmi.ptMaxSize.X = Math.Abs(workArea.Right - workArea.Left);
            mmi.ptMaxSize.Y = Math.Abs(workArea.Bottom - workArea.Top);

            Marshal.StructureToPtr(mmi, lParam, true);
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

        private void Window_SizeChanged(object sender, SizeChangedEventArgs e)
        {
            if(e.NewSize.Width < this.MinWidth)
            {
                return;
            }
        }

        private void PatreonLink_RequestNavigate(object sender, System.Windows.Navigation.RequestNavigateEventArgs e)
        {
            e.Uri.AbsoluteUri.OpenUrlInBrowser();
            e.Handled = true;
        }
    }
}
