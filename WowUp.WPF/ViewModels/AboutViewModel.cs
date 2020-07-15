using System.Collections.ObjectModel;
using System.IO;
using System.Linq;
using System.Reflection;
using WowUp.Common.Models;
using WowUp.Common.Services.Contracts;
using WowUp.WPF.Utilities;

namespace WowUp.WPF.ViewModels
{
    public class AboutViewModel : BaseViewModel
    {
        private readonly IWowUpService _wowUpService;

        private string _version;
        public string Version
        {
            get => _version;
            set { SetProperty(ref _version, value); }
        }

        public ObservableCollection<ChangeLog> ChangeLogs { get; set; }

        public AboutViewModel(IWowUpService wowUpService)
        {
            _wowUpService = wowUpService;

            ChangeLogs = new ObservableCollection<ChangeLog>();

            InitializeView();
        }

        private async void InitializeView()
        {
            Version = $"v{AppUtilities.CurrentVersionString}";

            var changeLogFile = await _wowUpService.GetChangeLogFile();
            if(changeLogFile == null)
            {
                return;
            }

            foreach(var changeLog in changeLogFile.ChangeLogs)
            {
                ChangeLogs.Add(changeLog);
            }
        }

        public string ReadResource(string name)
        {
            // Determine path
            var assembly = Assembly.GetExecutingAssembly();
            string resourcePath = name;
            // Format: "{Namespace}.{Folder}.{filename}.{Extension}"
            if (!name.StartsWith(nameof(WowUp)))
            {
                resourcePath = assembly.GetManifestResourceNames()
                    .Single(str => str.EndsWith(name));
            }

            using Stream stream = assembly.GetManifestResourceStream(resourcePath);
            using StreamReader reader = new StreamReader(stream);
            return reader.ReadToEnd();
        }
    }
}
