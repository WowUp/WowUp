using WowUp.Common.Enums;

namespace WowUp.Common.Models
{
    public class SessionState : ISessionState
    {
        public WowClientType SelectedClientType { get; set; }
        public string StatusText { get; set; }
        public bool UpdaterReady { get; set; }
    }
}
