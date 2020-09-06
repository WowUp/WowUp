using WowUp.Common.Models;
using WowUp.Common.Models.Events;

namespace WowUp.Common.Services.Contracts
{
    public delegate void SessionEventHandler(object sender, SessionEventArgs e);

    public interface ISessionService : ISessionState
    {
        event SessionEventHandler SessionChanged;

        void AppLoaded();
    }
}
