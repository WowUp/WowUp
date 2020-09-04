using System.Linq;
using WowUp.Common.Enums;
using WowUp.Common.Models;
using WowUp.Common.Models.Events;
using WowUp.Common.Services.Contracts;
using WowUp.WPF.Services.Contracts;

namespace WowUp.WPF.Services
{
    public class SessionService : ISessionService
    {
        private readonly SessionState _sessionState;

        public event SessionEventHandler SessionChanged;

        public SessionService(
            IWarcraftService warcraftService)
        {
            var installedClientTypes = warcraftService.GetWowClientTypes();
            var initialClientType = installedClientTypes.Any() ? installedClientTypes.First() : WowClientType.None;

            _sessionState = new SessionState
            {
                SelectedClientType = initialClientType
            };
        }

        public WowClientType SelectedClientType
        {
            get { return _sessionState.SelectedClientType; }
            set
            {
                _sessionState.SelectedClientType = value;
                SessionChanged?.Invoke(this, new SessionEventArgs(_sessionState));
            }
        }
    }
}
