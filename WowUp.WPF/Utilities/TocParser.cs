using System.Text.RegularExpressions;
using WowUp.WPF.Models;

namespace WowUp.WPF.Utilities
{
    public class TocParser
    {
        private readonly string _tocText;
        private readonly Regex ColorRegex = new Regex(@"\|[a-zA-Z0-9]{9}");
        private readonly Regex NewLineRegex = new Regex(@"\|r");

        public string Interface => GetValue("Interface");
        public string Title => GetValue("Title");
        public string Author => GetValue("Author");
        public string Website => GetValue("X-Website");
        public string Version => GetValue("Version");
        public string PartOf => GetValue("X-Part-Of");
        public string Category => GetValue("X-Category");
        public string Localizations => GetValue("X-Localizations");
        public string CurseProjectId => GetValue("X-Curse-Project-ID");
        public string WowInterfaceId => GetValue("X-WoWI-ID");
        public string Dependencies => GetValue("Dependencies");

        public Toc Toc => new Toc
        {
            Author = Author,
            Category = Category,
            Interface = Interface,
            Localizations = Localizations,
            PartOf = PartOf,
            Title = Title,
            Version = Version,
            Website = Website,
            Dependencies = Dependencies,
            CurseProjectId = CurseProjectId,
            WowInterfaceId = WowInterfaceId
        };

        public TocParser(string tocText)
        {
            _tocText = tocText;
        }

        private string GetValue(string key)
        {
            var regex = new Regex($"^## {key}:(.*?)$", RegexOptions.Multiline);
            var match = regex.Match(_tocText);

            if (match != null && match.Groups.Count == 2)
            {
                var value = match?.Groups[1].Value.Trim();
                value = StripEncodedChars(value);

                return value;
            }

            return string.Empty;
        }

        private string StripEncodedChars(string value)
        {
            var str = StripColorChars(value);
            str = StripNewLineChars(str);

            return str;
        }

        private string StripColorChars(string value)
        {
            var str = value;
            Match match;
            while ((match = ColorRegex.Match(str)).Success)
            {
                str = str.Replace(match.Value, "");
            }

            return str;
        }

        private string StripNewLineChars(string value)
        {
            var str = value;
            Match match;
            while ((match = NewLineRegex.Match(str)).Success)
            {
                str = str.Replace(match.Value, "");
            }

            return str;
        }
    }
}
