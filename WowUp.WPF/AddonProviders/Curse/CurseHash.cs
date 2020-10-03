using Serilog;
using System;
using System.IO;
using System.Linq;
using System.Text;

namespace WowUp.WPF.AddonProviders.Curse
{
    public class CurseHash
    {
        public static long GetFileDateHash(FileSystemInfo[] infos)
        {
            try
            {
                return infos.Length == 0 
                    ? 0L 
                    : ComputeHash(Encoding.ASCII.GetBytes(string.Join(",", infos.Select((n => n.LastWriteTimeUtc.Ticks.ToString())).ToArray())), false);
            }
            catch (Exception ex)
            {
                Log.Error("GetFileDateHash Exception!", ex);
                return 0;
            }
        }

        public static long ComputeFileHash(string path, bool normalizeWhitespace = false)
        {
            using FileStream fileStream = new FileStream(path, FileMode.Open, FileAccess.Read);
            return ComputeHash(fileStream, 0L, normalizeWhitespace);
        }

        public static long ComputeNormalizedFileHash(string path)
        {
            return ComputeFileHash(path, true);
        }

        public static long ComputeNormalizedLength(Stream input, byte[] buffer = null)
        {
            long num1 = 0;
            if (buffer == null)
                buffer = new byte[65536];
            label_2:
            int num2 = input.Read(buffer, 0, buffer.Length);
            if (num2 == 0)
                return num1;
            for (int index = 0; index < num2; ++index)
            {
                if (!IsWhitespaceCharacter(buffer[index]))
                    ++num1;
            }
            goto label_2;
        }

        private static bool IsWhitespaceCharacter(byte b)
        {
            return b == (byte)9 || b == (byte)10 || b == (byte)13 || b == (byte)32;
        }

        public static uint ComputeHash(byte[] input, bool normalizeWhitespace = false)
        {
            return ComputeHash(new MemoryStream(input), 0L, normalizeWhitespace);
        }

        public static uint ComputeHash(Stream input, long precomputedLength = 0, bool normalizeWhitespace = false)
        {
            long num1 = precomputedLength != 0L ? precomputedLength : input.Length;
            byte[] buffer = new byte[65536];
            if (precomputedLength == 0L & normalizeWhitespace)
            {
                long position = input.Position;
                num1 = ComputeNormalizedLength(input, buffer);
                input.Seek(position, SeekOrigin.Begin);
            }
            uint num2 = (uint)(1UL ^ (ulong)num1);
            uint num3 = 0;
            int num4 = 0;
            label_3:
            int num5 = input.Read(buffer, 0, buffer.Length);
            if (num5 != 0)
            {
                for (int index = 0; index < num5; ++index)
                {
                    byte b = buffer[index];
                    if (!normalizeWhitespace || !IsWhitespaceCharacter(b))
                    {
                        num3 |= (uint)b << num4;
                        num4 += 8;
                        if (num4 == 32)
                        {
                            uint num6 = num3 * 1540483477U;
                            uint num7 = (num6 ^ num6 >> 24) * 1540483477U;
                            num2 = num2 * 1540483477U ^ num7;
                            num3 = 0U;
                            num4 = 0;
                        }
                    }
                }
                goto label_3;
            }
            else
            {
                if (num4 > 0)
                    num2 = (num2 ^ num3) * 1540483477U;
                uint num6 = (num2 ^ num2 >> 13) * 1540483477U;
                return num6 ^ num6 >> 15;
            }
        }
    }
}
