using WowUp.Common.Enums;

namespace WowUp.Common.Models.Warcraft
{
    public class ChangedClient
    {
        public WowClientType ClientType { get; set; }
        public string PreviousLocation { get; set; }
        public string NewLocation { get; set; }
    }
}
