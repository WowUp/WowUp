using System.Collections.ObjectModel;
using System.IO;
using System.Linq;
using System.Reflection;
using WowUp.WPF.Models;

namespace WowUp.WPF.ViewModels
{
    public class AboutViewModel : BaseViewModel
    {
        private string _version;
        public string Version
        {
            get => _version;
            set { SetProperty(ref _version, value); }
        }

        public ObservableCollection<ChangeLog> ChangeLogs { get; set; }

        public AboutViewModel()
        {
            Version = "v" + GetType().Assembly.GetName().Version.ToString();

            var changelogTxt = ReadResource("changelog.json");
            var changelogFile = Newtonsoft.Json.JsonConvert.DeserializeObject<ChangeLogFile>(changelogTxt);
            ChangeLogs = new ObservableCollection<ChangeLog>(changelogFile.ChangeLogs);
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
