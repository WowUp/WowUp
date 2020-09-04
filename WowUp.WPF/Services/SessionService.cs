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
        private readonly IWowUpService _wowUpService;

        public event SessionEventHandler SessionChanged;

        public SessionService(
            IWarcraftService warcraftService,
            IWowUpService wowUpService)
        {
            _wowUpService = wowUpService;

            var installedClientTypes = warcraftService.GetWowClientTypes();
            var lastSelectedType = _wowUpService.GetLastSelectedClientType(); 
            var initialClientType = installedClientTypes.Any() ? installedClientTypes.First() : WowClientType.None;

            // If the user has no stored type, or the type is no longer found just set it.
            if(lastSelectedType == WowClientType.None || !installedClientTypes.Any(ct => ct == lastSelectedType))
            {
                _wowUpService.SetLastSelectedClientType(initialClientType);
            }
            else
            {
                initialClientType = lastSelectedType;
            }

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
                _wowUpService.SetLastSelectedClientType(value);
                _sessionState.SelectedClientType = value;
                SessionChanged?.Invoke(this, new SessionEventArgs(_sessionState));
            }
        }
    }
}
