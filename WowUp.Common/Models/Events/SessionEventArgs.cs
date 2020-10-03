namespace WowUp.Common.Models.Events
{
    public class SessionEventArgs
    {
        public SessionEventArgs(SessionState sessionState)
        {
            SessionState = sessionState;
        }

        public SessionState SessionState { get; set; }

    }
}
