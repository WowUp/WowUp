using ProtoBuf;

namespace WowUp.Common.Models.Warcraft
{
    [ProtoContract]
    public class Product
    {
        [ProtoMember(1)]
        public string Name { get; set; }

        [ProtoMember(2)]
        public string Alias { get; set; }

        [ProtoMember(3)]
        public Client Client { get; set; }

        [ProtoMember(6)]
        public string Family { get; set; }
    }
}
