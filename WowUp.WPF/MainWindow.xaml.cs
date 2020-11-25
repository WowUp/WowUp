using Microsoft.Extensions.DependencyInjection;
using System;
using System.ComponentModel;
using System.Runtime.InteropServices;
using System.Windows;
using System.Windows.Forms;
using System.Windows.Interop;
using System.Windows.Threading;
using WowUp.WPF.Enums;
using WowUp.WPF.Extensions;
using WowUp.WPF.Repositories.Base;
using WowUp.WPF.Repositories.Contracts;
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
        private readonly IServiceProvider _serviceProvider;

        private readonly MainWindowViewModel _viewModel;

        public MainWindow(
            IServiceProvider serviceProvider,
            IIpcServerService ipcServerService,
            MainWindowViewModel viewModel)
        {
            _serviceProvider = serviceProvider;

            DataContext = _viewModel = viewModel;

            ipcServerService.CommandReceived += (sender, args) =>
            {
                if (args.Command != IpcCommand.Show)
                {
                    return;
                }

                ShowFromBackground();
            };

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
            _viewModel.TaskbarIcon = TrayIcon;
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
            IBaseRepository addonRepo = _serviceProvider.GetService<IAddonRepository>();
            addonRepo.ShutDown();

            base.OnClosed(e);
        }

        protected override void OnClosing(CancelEventArgs e)
        {
            base.OnClosing(e);
            _viewModel.OnClosing(this);
        }

        private static IntPtr WindowProc(IntPtr hwnd, int msg, IntPtr wParam, IntPtr lParam, ref bool handled)
        {
            switch (msg)
            {
                case 0x0084: /*WM_NCHITTEST*/
                    // Attempt to prevent a crash in WindowChromeWorker._HandleNCHitTest
                    try
                    {
                        lParam.ToInt32();
                    }
                    catch (OverflowException)
                    {
                        handled = true;
                    }
                    break;
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

        private void Window_IsVisibleChanged(object sender, DependencyPropertyChangedEventArgs e)
        {
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
            if (e.NewSize.Width < this.MinWidth)
            {
                return;
            }
        }

        private void PatreonLink_RequestNavigate(object sender, System.Windows.Navigation.RequestNavigateEventArgs e)
        {
            e.Uri.AbsoluteUri.OpenUrlInBrowser();
            e.Handled = true;
        }

        private void ShowFromBackground()
        {
            System.Windows.Application.Current.Dispatcher.Invoke(DispatcherPriority.Background, new Action(() =>
            {
                Show();
                WindowState = WindowState.Normal;
                Activate();
            }));
        }
    }
}
