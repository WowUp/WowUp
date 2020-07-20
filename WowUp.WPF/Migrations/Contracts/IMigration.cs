using SQLite;

namespace WowUp.WPF.Migrations.Contracts
{
    public interface IMigration
    {
        public int TargetSchemaVersion { get; }

        public void Execute(SQLiteConnection connection);
    }
}
