using CommandLine;
using System;
using System.Collections.Generic;
using System.Text;
using WowUp.Common.Enums;

namespace WowUp.WPF.Utilities
{
    public class StartupOptions
    {
        [Option(shortName: 'i', longName: "install", HelpText = "Specify addon urls to install them")]
        public IEnumerable<string> InputURLs { get; set; }
        [Option(shortName: 's', longName: "silent", HelpText = "Start application minimized")]
        public bool Silent { get; set; }
        [Option(shortName: 'u', longName: "update", HelpText = "Update non-ignored addons on startup")]
        public bool Update { get; set; }
        [Option(shortName: 'f', longName: "force", HelpText = "Update all addons on startup")]
        public bool Force { get; set; }
        [Option(shortName: 'c', longName: "client", HelpText = "Specify client version to use", Default = WowClientType.None)]
        public WowClientType ClientType { get; set; }
    }
}
