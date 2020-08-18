using WowUp.Common.Enums;

namespace WowUp.Common.Models
{
    public class SessionState : ISessionState
    {
        public WowClientType SelectedClientType { get; set; }
    }
}
