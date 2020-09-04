using Serilog;
using System;
using System.IO.Pipes;
using System.Threading.Tasks;
using WowUp.WPF.Enums;
using WowUp.WPF.Models.Events;
using WowUp.WPF.Services.Contracts;

namespace WowUp.WPF.Services
{
    public class IpcServerService : IIpcServerService
    {
        private string _pipeName = string.Empty;
        private bool _isListening = false;

        public event IpcEventHandler CommandReceived;

        public void Start(string pipeName)
        {
            if (_isListening)
            {
                Log.Warning("Ipc service already listening");
                return;
            }

            _isListening = true;
            _pipeName = pipeName;

            Listen();
        }

        public void Send(string pipeName, IpcCommand command)
        {
            try
            {
                var clientStream = new NamedPipeClientStream(pipeName);
                try
                {
                    clientStream.Connect(500);
                }
                catch (TimeoutException)
                {
                    return;
                }

                clientStream.WriteByte((byte)command);

                clientStream.Close();
            }
            catch(Exception ex)
            {
                Log.Error(ex, "failed to send pipe command");
            }
        }

        private async void Listen()
        {
            try
            {
                using (var serverStream = GetServerStream())
                {
                    await Task.Factory.FromAsync(
                       (cb, state) => serverStream.BeginWaitForConnection(cb, state),
                       ar => serverStream.EndWaitForConnection(ar),
                       null);

                    var command = ParseCommand(serverStream.ReadByte());

                    CommandReceived?.Invoke(this, new IpcEventArgs(command));

                    serverStream.Disconnect();
                }

                Listen();
            } 
            catch(Exception ex)
            {
                Log.Error(ex, "Failed to listen for IPC commands");
            }
        }

        private NamedPipeServerStream GetServerStream()
        {
            return new NamedPipeServerStream(
                _pipeName,
                PipeDirection.InOut,
                1,
                PipeTransmissionMode.Byte,
                PipeOptions.Asynchronous);
        }

        private IpcCommand ParseCommand(int v)
        {
            if (Enum.TryParse<IpcCommand>($"{v}", out var cmd))
            {
                return cmd;
            }

            return IpcCommand.None;
        }
    }
}
