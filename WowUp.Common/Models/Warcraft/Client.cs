using ProtoBuf;

namespace WowUp.Common.Models.Warcraft
{
    [ProtoContract]
    public class Client
    {
        [ProtoMember(1)]
        public string Location { get; set; }

        [ProtoMember(13)]
        public string Name { get; set; }
    }
}
