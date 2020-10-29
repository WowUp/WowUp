using System;
using WowUp.WPF.Extensions;

namespace WowUp.WPF.Commands
{
    public class UrlCommand : RelayCommand
    {
        public UrlCommand(Func<bool> canExecuteFunction = null)
            : base(ExecuteImpl, canExecuteFunction)
        {
        }

        private static void ExecuteImpl(object parameter)
        {
            parameter.ToString().OpenUrlInBrowser();
        }
    }
}
