using System;
using System.Collections.Generic;
using System.IO;
using System.Text;
using System.Text.RegularExpressions;
using System.Threading.Tasks;
using WowUp.Common.Extensions;

namespace WowUp.WPF.AddonProviders.Curse
{
    /// <summary>
    /// Parse a single addon directory
    /// </summary>
    public class CurseFolderScanner
    {
        private readonly DirectoryInfo _addonDirectory;

        private Regex TocFileCommentsRegex() => new Regex(@"(?m)\s*#.*$");
        private Regex TocFileIncludesRegex() => new Regex(@"(?mi)^\s*((?:(?<!\.\.).)+\.(?:xml|lua))\s*$");
        private Regex TocFileRegex() => new Regex(@"(?i)^([^\/]+)[\\\/]\1\.toc$");

        private Regex BindingsXmlCommentsRegex() => new Regex(@"(?s)<!--.*?-->");
        private Regex BindingsXmlIncludesRegex() => new Regex(@"(?i)<(?:Include|Script)\s+file=[\""\""']((?:(?<!\.\.).)+)[\""\""']\s*/>");
        private Regex BindingsXmlRegex() => new Regex(@"(?i)^[^\/\\]+[\/\\]Bindings\.xml$");

        public int FileCount { get; private set; }
        public long FileDateHash { get; private set; }
        public long Fingerprint { get; private set; }
        public string FolderName { get; private set; }
        public List<long> IndividualFingerprints { get; private set; }
        public DateTime LastWriteTimeUtc { get { return _addonDirectory.LastWriteTimeUtc; } }

        public CurseFolderScanner(DirectoryInfo addonDirectory)
        {
            _addonDirectory = addonDirectory;
        }

        private static bool FilePathHasInvalidChars(string path)
        {
            return !string.IsNullOrEmpty(path) && path.IndexOfAny(Path.GetInvalidPathChars()) >= 0;
        }

        public async Task<CurseFolderScanner> ScanFolder()
        {
            var fileSystemInfos = _addonDirectory.GetFileSystemInfos();
            FileCount = fileSystemInfos.Length;
            FileDateHash = CurseHash.GetFileDateHash(fileSystemInfos);

            var matchingFiles = await GetMatchingFiles(_addonDirectory);
            matchingFiles.Sort();

            IndividualFingerprints = new List<long>();
            //var tuples = new List<(long, string)>();
            foreach (string path in matchingFiles)
            {
                var normalizedFileHash = CurseHash.ComputeNormalizedFileHash(path);
                IndividualFingerprints.Add(normalizedFileHash);
                //tuples.Add((normalizedFileHash, path));
            }

            IndividualFingerprints.Sort();

            //tuples.Sort((a, b) => a.Item1.CompareTo(b.Item1));

            var hashConcat = string.Join(string.Empty, IndividualFingerprints);
            Fingerprint = CurseHash.ComputeHash(Encoding.ASCII.GetBytes(hashConcat), false);

            return this;
        }

        private async Task<List<string>> GetMatchingFiles(DirectoryInfo directory)
        {
            var matchingFileList = new List<string>();
            var fileInfoList = new List<FileInfo>();

            string str = _addonDirectory.Parent.FullName + Path.DirectorySeparatorChar.ToString();
            foreach (FileInfo file in directory.GetFiles("*.*", SearchOption.AllDirectories))
            {
                string input = file.FullName.ToLower().Replace(str.ToLower(), "");
                if (TocFileRegex().Match(input).Success)
                {
                    fileInfoList.Add(file);
                }

                if (BindingsXmlRegex().Match(input).Success)
                {
                    matchingFileList.Add(file.FullName.ToLowerInvariant());
                }
            }

            foreach (var fileInfo in fileInfoList)
            {
                await ProcessIncludeFile(matchingFileList, fileInfo);
            }

            return matchingFileList;
        }

        private async Task ProcessIncludeFile(List<string> matchingFileList, FileInfo fileInfo)
        {
            if (!fileInfo.Exists || matchingFileList.Contains(fileInfo.FullName.ToLowerInvariant()))
            {
                return;
            }

            matchingFileList.Add(fileInfo.FullName.ToLowerInvariant());

            string input = await fileInfo.ReadTextAsync();
            //using (var streamReader = new StreamReader(fileInfo.FullName))
            //{
            //    input = streamReader.ReadToEnd();
            //    streamReader.Close();
            //}

            input = RemoveComments(fileInfo, input);

            var inclusions = GetFileInclusionMatches(fileInfo, input);
            if (inclusions == null)
            {
                return;
            }

            foreach (Match match in inclusions)
            {
                string fileName;
                string str = match.Groups[1].Value;
                if (FilePathHasInvalidChars(str))
                {
                    // ERROR
                }

                fileName = Path.Combine(fileInfo.DirectoryName, str);

                await ProcessIncludeFile(matchingFileList, new FileInfo(fileName));
            }
        }

        private MatchCollection GetFileInclusionMatches(FileInfo fileInfo, string fileContent)
        {
            return fileInfo.Extension switch
            {
                ".xml" => BindingsXmlIncludesRegex().Matches(fileContent),
                ".toc" => TocFileIncludesRegex().Matches(fileContent),
                _ => null,
            };
        }

        private string RemoveComments(FileInfo fileInfo, string fileContent)
        {
            return fileInfo.Extension switch
            {
                ".xml" => BindingsXmlCommentsRegex().Replace(fileContent, string.Empty),
                ".toc" => TocFileCommentsRegex().Replace(fileContent, string.Empty),
                _ => fileContent,
            };
        }
    }
}
