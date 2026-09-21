using System.Runtime.InteropServices;

namespace IMAPRemailer.Tray;

/// <summary>Preserves the visible RichTextBox line while live logs arrive.</summary>
internal static class NativeScroll
{
    private const int GetFirstVisibleLineMessage = 0xCE;
    private const int LineScrollMessage = 0xB6;

    /// <summary>Gets the first line visible in a text control.</summary>
    /// <param name="handle">The text control window handle.</param>
    /// <returns>The first visible line index.</returns>
    public static int GetFirstVisibleLine(IntPtr handle) =>
        (int)SendMessage(
            handle,
            GetFirstVisibleLineMessage,
            IntPtr.Zero,
            IntPtr.Zero
        );

    /// <summary>Restores the first visible line after text is appended.</summary>
    /// <param name="handle">The text control window handle.</param>
    /// <param name="line">The desired first visible line.</param>
    public static void SetFirstVisibleLine(IntPtr handle, int line)
    {
        var current = GetFirstVisibleLine(handle);
        SendMessage(
            handle,
            LineScrollMessage,
            IntPtr.Zero,
            (IntPtr)(line - current)
        );
    }

    #region Private

    [DllImport("user32.dll", CharSet = CharSet.Auto)]
    private static extern IntPtr SendMessage(
        IntPtr handle,
        int message,
        IntPtr wParam,
        IntPtr lParam
    );

    #endregion
}
