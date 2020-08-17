using Microsoft.Extensions.DependencyInjection;
using Serilog;
using System;
using System.Diagnostics;
using System.IO;
using System.Linq;
using System.Runtime.InteropServices;
using System.Threading;
using System.Threading.Tasks;
using System.Windows;
using WowUp.Common.Services.Contracts;
using WowUp.WPF.AddonProviders;
using WowUp.WPF.AddonProviders.Contracts;
using WowUp.WPF.Repositories;
using WowUp.WPF.Repositories.Contracts;
using WowUp.WPF.Services;
using WowUp.WPF.Services.Contracts;
using WowUp.WPF.Utilities;
using WowUp.WPF.ViewModels;
using WowUp.WPF.Views;
using static WowUp.WPF.Utilities.WindowUtilities;

namespace WowUp.WPF
{
    /// <summary>
    /// Interaction logic for App.xaml
    /// </summary>
    public partial class App : Application
    {
        private static readonly Mutex singleton = new Mutex(true, "WowUp.io");

        private readonly ServiceProvider _serviceProvider;
        private readonly IAnalyticsService _analyticsService;

        [DllImport("user32.dll")]
        [return: MarshalAs(UnmanagedType.Bool)]
        public static extern bool ShowWindow(IntPtr hWnd, ShowWindowEnum flags);

        [DllImport("user32.dll")]
        public static extern int SetForegroundWindow(IntPtr hwnd);

        public App()
        {
            AppDomain.CurrentDomain.UnhandledException += new UnhandledExceptionEventHandler(ExceptionHandler);
            Application.Current.DispatcherUnhandledException += Current_DispatcherUnhandledException;
            TaskScheduler.UnobservedTaskException += TaskScheduler_UnobservedTaskException;

            var logFilePath = Path.Combine(FileUtilities.AppLogsPath, "wowup-logs.txt");

            Log.Logger = new LoggerConfiguration()
                .MinimumLevel.Debug()
                .WriteTo.Console()
                .WriteTo.File(logFilePath, rollingInterval: RollingInterval.Day, retainedFileCountLimit: 7)
                .CreateLogger();

            Log.Information($"Starting {AppUtilities.CurrentVersion}");

            var serviceCollection = new ServiceCollection();
            ConfigureServices(serviceCollection);

            _serviceProvider = serviceCollection.BuildServiceProvider();
            _analyticsService = _serviceProvider.GetRequiredService<IAnalyticsService>();
        }

        protected override void OnStartup(StartupEventArgs e)
        {
            HandleSingleInstance();

            var mainWindow = _serviceProvider.GetRequiredService<MainWindow>();
            mainWindow.Show();
        }

        protected override void OnExit(ExitEventArgs e)
        {
            Log.CloseAndFlush();

            base.OnExit(e);
        }

        private void ConfigureServices(IServiceCollection services)
        {
            services.AddMemoryCache();

            services.AddTransient<AboutViewModel>();
            services.AddTransient<AddonListItemViewModel>();
            services.AddTransient<AddonsViewViewModel>();
            services.AddTransient<GetAddonsViewModel>();
            services.AddTransient<InstallUrlDialogViewModel>();
            services.AddTransient<MainWindowViewModel>();
            services.AddTransient<OptionsViewModel>();
            services.AddTransient<PotentialAddonListItemViewModel>();
            services.AddTransient<ApplicationUpdateControlViewModel>();

            services.AddTransient<AboutView>();
            services.AddTransient<AddonsView>();
            services.AddTransient<GetAddonsView>();
            services.AddTransient<OptionsView>();
            services.AddTransient<InstallUrlWindow>();

            services.AddTransient<ICurseAddonProvider, CurseAddonProvider>();
            services.AddTransient<IGitHubAddonProvider, GitHubAddonProvider>();
            services.AddTransient<ITukUiAddonProvider, TukUiAddonProvider>();
            services.AddTransient<IWowInterfaceAddonProvider, WowInterfaceAddonProvider>();
            services.AddTransient<ApplicationUpdater>();

            services.AddSingleton<MainWindow>();

            services.AddSingleton<IAddonService, AddonService>();
            services.AddSingleton<IAnalyticsService, AnalyticsService>();
            services.AddSingleton<ICacheService, CacheService>();
            services.AddSingleton<IDownloadService, DownloadService>();
            services.AddSingleton<IMigrationService, MigrationService>();
            services.AddSingleton<IWarcraftService, WarcraftService>();
            services.AddSingleton<IWowUpService, WowUpService>();
            services.AddSingleton<IWowUpApiService, WowUpApiService>();

            services.AddSingleton<IAddonRepository, AddonRepository>();
            services.AddSingleton<IPreferenceRepository, PreferenceRepository>();
        }

        private void TaskScheduler_UnobservedTaskException(object sender, UnobservedTaskExceptionEventArgs e)
        {
            _analyticsService.Track(e.Exception, true);
            Log.Error(e.Exception, "Uncaught Exception");
            Log.Error($"Terminating");
        }

        private void Current_DispatcherUnhandledException(object sender, System.Windows.Threading.DispatcherUnhandledExceptionEventArgs e)
        {
            _analyticsService.Track(e.Exception, true);
            Log.Error(e.Exception, "Uncaught Exception");
            Log.Error($"Terminating");
        }

        private void ExceptionHandler(object sender, UnhandledExceptionEventArgs args)
        {
            Exception e = (Exception)args.ExceptionObject;
            _analyticsService.Track(e, true);

            Log.Error(e, "Uncaught Exception");
            Log.Error($"Terminating {args.IsTerminating}");
        }

        private void HandleSingleInstance()
        {
            if (singleton.WaitOne(TimeSpan.Zero, true))
            {
                return;
            }

            MessageBox.Show("WowUp is already running.");

            var currentPocess = Process.GetCurrentProcess();
            var runningProcess = Process
                .GetProcessesByName(currentPocess.ProcessName)
                .FirstOrDefault(p => p.Id != currentPocess.Id);

            if (runningProcess != null)
            {
                if (runningProcess.MainWindowHandle == IntPtr.Zero)
                {
                    ShowWindow(runningProcess.Handle, ShowWindowEnum.Show);
                }

                SetForegroundWindow(runningProcess.MainWindowHandle);
            }

            //there is already another instance running!
            Current.Shutdown();
        }
    }
}
