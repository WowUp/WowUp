using Windows.UI.Xaml;
using Xamarin.Forms.Platform.UWP;

[assembly: ExportRenderer(typeof(WowUp.Views.MainPage), typeof(WowUp.UWP.Views.WowUpTabbedPageRenderer))]
namespace WowUp.UWP.Views
{
    public class WowUpTabbedPageRenderer : TabbedPageRenderer
    {
        public WowUpTabbedPageRenderer() : base()
        {
        }

        protected override void OnElementChanged(VisualElementChangedEventArgs e)
        {
            base.OnElementChanged(e);

            if (Control != null)
            {
                Control.Style = (Style)Application.Current.Resources["DefaultPivotStyle"];
            }
        }
    }
}
