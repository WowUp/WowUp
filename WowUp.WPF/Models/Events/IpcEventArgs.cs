using WowUp.WPF.Enums;

namespace WowUp.WPF.Models.Events
{
    public class IpcEventArgs
    {
        public IpcCommand Command { get; set; }

        public IpcEventArgs(IpcCommand command)
        {
            Command = command;
        }
    }
}
