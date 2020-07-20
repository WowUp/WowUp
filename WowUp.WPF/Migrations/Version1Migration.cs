using Serilog;
using SQLite;
using System;
using System.Collections.Generic;
using System.Text;
using WowUp.WPF.Migrations.Contracts;

namespace WowUp.WPF.Migrations
{
    public class Version1Migration : IMigration
    {
        public int TargetSchemaVersion => 1;

        public void Execute(SQLiteConnection connection)
        {
            try
            {
                connection.BeginTransaction();

                connection.Execute("UPDATE Addons SET ChannelType = 0 WHERE ChannelType is NULL");

                connection.Commit();
            }
            catch
            {
                connection.Rollback();

                throw;
            }
        }
    }
}
