using ProtoBuf;

namespace WowUp.Common.Models.Warcraft
{
    [ProtoContract]
    public class ProductDb
    {
        [ProtoMember(1)]
        public Product[] Products { get; set; }

        [ProtoMember(7)]
        public string[] ProductNames { get; set; }
    }
}
