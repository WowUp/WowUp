using SQLite;
using System;
using System.Collections.Generic;
using System.Threading.Tasks;

namespace WowUp.WPF.Services.Contracts
{
    public interface IDataStore<T>
    {
        bool AddItem(T item);
        bool AddItems(IEnumerable<T> item);
        bool UpdateItem(T item);
        bool DeleteItem(string id);
        IEnumerable<T> Query(Func<TableQuery<T>, TableQuery<T>> action);
        T Query(Func<TableQuery<T>, T> action);


        Task<bool> AddItemAsync(T item);
        Task<bool> UpdateItemAsync(T item);
        Task<bool> DeleteItemAsync(string id);
        Task<T> GetItemAsync(string id);
        Task<IEnumerable<T>> GetItemsAsync(bool forceRefresh = false);
    }
}
