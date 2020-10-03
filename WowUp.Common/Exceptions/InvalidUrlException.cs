using System;

namespace WowUp.Common.Exceptions
{
    public class InvalidUrlException : Exception
    {

        public InvalidUrlException() : base() { }
        public InvalidUrlException(string message) : base(message) { }
    }
}
