using CommandLine;

namespace WowUp.Updater.Models
{
    public class Options
    {
        [Option('o', "origin", Required = true, HelpText = "The current WowUp.exe path")]
        public string Origin { get; set; }

        [Option('u', "update", Required = true, HelpText = "The WowUp.exe update path")]
        public string Update { get; set; }
    }
}
