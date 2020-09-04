namespace WowUp.WPF.Models.Events
{
    public class SearchInputEventArgs
    {
        public string Text { get; set; }

        public SearchInputEventArgs(string text)
        {
            Text = text;
        }
    }
}
