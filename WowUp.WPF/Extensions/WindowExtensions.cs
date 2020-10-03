﻿using System.Windows;
using System.Windows.Interop;
using WowUp.WPF.Utilities;

namespace WowUp.WPF.Extensions
{
    public static class WindowExtensions
    {
        public static void SetPlacement(this Window window, string placementXml)
        {
            WindowUtilities.SetPlacement(new WindowInteropHelper(window).Handle, placementXml);
        }

        public static string GetPlacement(this Window window)
        {
            return WindowUtilities.GetPlacement(new WindowInteropHelper(window).Handle);
        }
    }
}
