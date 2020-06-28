using SQLite;
using System;

namespace WowUp.Entities
{
    [Table("Preferences")]
    public class Preference : BaseEntity
    {
        private int _id;
        [PrimaryKey, AutoIncrement]
        public int Id
        {
            get => _id;
            set { SetProperty(ref _id, value); }
        }

        private string _key;
        public string Key
        {
            get => _key;
            set { SetProperty(ref _key, value); }
        }

        private string _value;
        public string Value
        {
            get => _value;
            set { SetProperty(ref _value, value); }
        }

        private DateTime _updatedAt;
        public DateTime UpdatedAt
        {
            get => _updatedAt;
            set { SetProperty(ref _updatedAt, value); }
        }
    }
}
