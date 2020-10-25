using System;
using System.Windows.Input;

namespace WowUp.WPF.Commands
{
    public class RelayCommand : ICommand
    {
        private readonly Action<object> _ExecuteAction;
        private readonly Func<bool> _CanExecuteFunction;

        public event EventHandler CanExecuteChanged;

        public RelayCommand(Action<object> executeAction, Func<bool> canExecuteFunction = null)
        {
            if (executeAction == null) throw new ArgumentNullException(nameof(executeAction));

            _ExecuteAction = executeAction;
            _CanExecuteFunction = canExecuteFunction;
        }

        public bool CanExecute(object parameter)
        {
            return _CanExecuteFunction?.Invoke() ?? true;
        }

        public void Execute(object parameter)
        {
            _ExecuteAction(parameter);
        }

        public void Execute()
        {
            _ExecuteAction(null);
        }

        public void RaiseCanExecuteChanged()
        {
            var handler = CanExecuteChanged;

            handler?.Invoke(this, EventArgs.Empty);
        }
    }
}
