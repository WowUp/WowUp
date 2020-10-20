using System;
using System.Collections.Generic;
using System.Collections.ObjectModel;
using System.IO;
using System.Linq;
using System.Text;
using System.Windows;
using WowUp.Common.Enums;
using WowUp.WPF.AddonProviders.Contracts;
using WowUp.WPF.Services.Contracts;
using WowUp.WPF.Utilities;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Win32;
using Serilog;
using WowUp.WPF.Services;


namespace WowUp.WPF.ViewModels
{
    public class ImportInProgressViewModel : BaseViewModel
    {
        private readonly IAddonService _addonService;
        private readonly IAnalyticsService _analyticsService;

        private Window _window;
        public Window Window
        {
            get => _window;
            set { SetProperty(ref _window, value); }
        }

        private string _progressText;
        public string ProgressText
        {
            get => _progressText;
            set
            {
                SetProperty(ref _progressText, value);
            }
        }


        public WowClientType ClientType { get; set; }

        private string _title;
        public string Title
        {
            get => _title;
            set { SetProperty(ref _title, value); }
        }

        private bool _enableCloseButton;
        public bool EnableCloseButton
        {
            get => _enableCloseButton;
            set { SetProperty(ref _enableCloseButton, value); }
        }


        public Command CloseCommand { get; set; }

        public ImportInProgressViewModel(
            IAddonService addonService,
            IAnalyticsService analyticsService)
        {
            _addonService = addonService;
            _analyticsService = analyticsService;

            Title = "Install Addon URL";
            CloseCommand = new Command(() => OnClose());

            EnableCloseButton = true;

        }

        private async void OnClose()
        {
            Window.Close();
        }


    }
}
