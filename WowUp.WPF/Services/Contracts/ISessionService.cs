using Hardcodet.Wpf.TaskbarNotification;
using System;
using WowUp.Common.Models;
using WowUp.Common.Models.Events;

namespace WowUp.WPF.Services.Contracts
{
    public delegate void SessionEventHandler(object sender, SessionEventArgs e);
    public delegate void SessionTabEventHandler(object sender, Type tabType);
    public delegate void SessionTextEventHandler(object sender, string text);

    public interface ISessionService : ISessionState
    {
        event SessionEventHandler SessionChanged;
        event SessionTabEventHandler TabChanged;
        event SessionTextEventHandler ContextTextChanged;

        void SetContextText(object requestor, string text);
        string ContextText { get; }

        Type SelectedTabType { get; set; }
        TaskbarIcon TaskbarIcon { get; set; }

        void AppLoaded();
    }
}
