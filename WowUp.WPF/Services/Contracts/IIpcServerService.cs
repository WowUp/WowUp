using WowUp.WPF.Enums;
using WowUp.WPF.Models.Events;

namespace WowUp.WPF.Services.Contracts
{
    public delegate void IpcEventHandler(object sender, IpcEventArgs e);

    public interface IIpcServerService
    {
        event IpcEventHandler CommandReceived;

        void Start(string pipeName);

        void Send(string pipeName, IpcCommand command);
    }
}
