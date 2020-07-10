using Microsoft.Extensions.DependencyInjection;
using Serilog;
using System;
using System.IO;
using System.Windows;
using WowUp.WPF.AddonProviders;
using WowUp.WPF.Repositories;
using WowUp.WPF.Repositories.Contracts;
using WowUp.WPF.Services;
using WowUp.WPF.Services.Contracts;
using WowUp.WPF.Utilities;
using WowUp.WPF.ViewModels;
using WowUp.WPF.Views;

namespace WowUp.WPF
{
    /// <summary>
    /// Interaction logic for App.xaml
    /// </summary>
    public partial class App : Application
    {
        private readonly ServiceProvider _serviceProvider;

        public App()
        {
            AppDomain.CurrentDomain.UnhandledException += new UnhandledExceptionEventHandler(ExceptionHandler);

            var logFilePath = Path.Combine(FileUtilities.AppLogsPath, "wowup-logs.txt");

            Log.Logger = new LoggerConfiguration()
                .MinimumLevel.Debug()
                .WriteTo.Console()
                .WriteTo.File(logFilePath, rollingInterval: RollingInterval.Day, retainedFileCountLimit: 7)
                .CreateLogger();

            Log.Information($"Starting {GetType().Assembly.GetName().Version}");

            var serviceCollection = new ServiceCollection();
            ConfigureServices(serviceCollection);

            _serviceProvider = serviceCollection.BuildServiceProvider();
        }

        protected override void OnStartup(StartupEventArgs e)
        {
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
            services.AddTransient<MainWindowViewModel>();
            services.AddTransient<OptionsViewModel>();
            services.AddTransient<InstallUrlDialogViewModel>();

            services.AddTransient<AboutView>();
            services.AddTransient<AddonsView>();
            services.AddTransient<OptionsView>();
            services.AddTransient<InstallUrlWindow>();

            services.AddTransient<CurseAddonProvider>();
            services.AddTransient<TukUiAddonProvider>();

            services.AddSingleton<MainWindow>();

            services.AddSingleton<IAddonService, AddonService>();
            services.AddSingleton<IWarcraftService, WarcraftService>();
            services.AddSingleton<IDownloadSevice, DownloadService>();
            services.AddSingleton<IWowUpService, WowUpService>();
            services.AddSingleton<IAnalyticsService, AnalyticsService>();

            services.AddSingleton<IAddonRepository, AddonRepository>();
            services.AddSingleton<IPreferenceRepository, PreferenceRepository>();
        }

        static void ExceptionHandler(object sender, UnhandledExceptionEventArgs args)
        {
            Exception e = (Exception)args.ExceptionObject;
            Log.Error(e, "Uncaught Exception");
            Log.Error($"Terminating {args.IsTerminating}");
        }
    }
}
