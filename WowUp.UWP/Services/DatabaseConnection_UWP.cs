using SQLite;
using System.IO;
using Windows.Storage;
using WowUp.Services;
using Xamarin.Forms;

[assembly: Dependency(typeof(WowUp.UWP.Services.DatabaseConnection_UWP))]
namespace WowUp.UWP.Services
{
    public class DatabaseConnection_UWP : IDatabaseConnection
    {
        public SQLiteConnection DbConnection()
        {
            var dbName = "WowUp.db3";
            var path = Path.Combine(ApplicationData.Current.LocalFolder.Path, dbName);
            return new SQLiteConnection(path);
        }
    }
}
