using SQLite;
using System;
using System.Collections.Generic;

namespace WowUp.WPF.Repositories.Contracts
{
    public interface IDataStore<T> : IBaseRepository
    {
        bool AddItem(T item);
        bool AddItems(IEnumerable<T> item);
        bool SaveItem(T item);
        bool SaveItems(IEnumerable<T> items);
        bool UpdateItem(T item);
        bool DeleteItem(T item);
        bool DeleteItems(IEnumerable<T> addons);
        IEnumerable<T> Query(Func<TableQuery<T>, TableQuery<T>> action);
        T Query(Func<TableQuery<T>, T> action);
    }
}
