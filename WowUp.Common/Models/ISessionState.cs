using WowUp.Common.Enums;

namespace WowUp.Common.Models
{
    public interface ISessionState
    {
        WowClientType SelectedClientType { get; set; }
    }
}
