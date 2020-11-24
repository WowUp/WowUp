using CommandLine;
using System.Collections.Generic;
using WowUp.Common.Enums;

namespace WowUp.WPF.Models.WowUp
{
    public class StartupOptions
    {
        [Option(shortName: 'i', longName: "install", HelpText = "Specify addon URLs to install them")]
        public IEnumerable<string> InputURLs { get; set; }
        [Option(shortName: 'm', longName: "minimized", HelpText = "Start the application minimized")]
        public bool Minimized { get; set; }
        [Option(shortName: 'q', longName: "quit", HelpText = "Exit the application after auto-updates")]
        public bool Quit { get; set; }
        [Option(shortName: 'c', longName: "client", HelpText = "Specify client version to use", Default = WowClientType.None)]
        public WowClientType ClientType { get; set; }
    }
}
