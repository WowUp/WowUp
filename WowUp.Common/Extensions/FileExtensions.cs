using System;
using System.Collections.Generic;
using System.IO;
using System.Text;
using System.Threading.Tasks;

namespace WowUp.Common.Extensions
{
    public static class FileExtensions
    {
        public static async Task<string> ReadTextAsync(this FileInfo fileInfo)
        {
            using (FileStream sourceStream = new FileStream(
                fileInfo.FullName,
                FileMode.Open, 
                FileAccess.Read, 
                FileShare.ReadWrite,
                bufferSize: 4096, 
                useAsync: true))
            {
                StringBuilder sb = new StringBuilder();

                byte[] buffer = new byte[0x1000];
                int numRead;
                while ((numRead = await sourceStream.ReadAsync(buffer, 0, buffer.Length)) != 0)
                {
                    string text = Encoding.ASCII.GetString(buffer, 0, numRead);
                    sb.Append(text);
                }

                return sb.ToString();
            }
        }
    }
}
