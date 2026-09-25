using IMAPRemailer.Core.Email;
using IMAPRemailer.Core.Email.Helpers;
using IMAPRemailer.Core.Email.Models;

namespace IMAPRemailer.Tray;

/// <summary>Displays an anchored flyout with recent runs and their live logs.</summary>
public sealed class SummaryForm : Form
{
    private readonly IJobRunHistory history;
    private readonly bool fullWindow;
    private readonly FlowLayoutPanel runList;
    private readonly Panel? viewport;
    private readonly OverlayScrollBar? overlayScrollBar;
    private readonly System.Windows.Forms.Timer? scrollBarTimer;
    private readonly Dictionary<long, RunCard> cards = [];
    private long? expandedRunId;
    private bool backgroundRunning;
    private bool deleting;
    private bool initialized;
    private bool flyoutMode;
    private bool userSelectedRun;
    private int scrollOffset;

    /// <summary>Creates the compact run history flyout.</summary>
    /// <param name="history">The persisted runs and logs.</param>
    /// <param name="fullWindow">Whether to display a resizable history window.</param>
    public SummaryForm(IJobRunHistory history, bool fullWindow = false)
    {
        this.history = history;
        this.fullWindow = fullWindow;
        Text = "IMAP Remailer";
        Icon = System.Drawing.Icon.ExtractAssociatedIcon(
            Application.ExecutablePath
        );
        FormBorderStyle = fullWindow
            ? FormBorderStyle.Sizable
            : FormBorderStyle.None;
        ShowInTaskbar = fullWindow;
        StartPosition = fullWindow
            ? FormStartPosition.CenterScreen
            : FormStartPosition.Manual;
        TopMost = !fullWindow;
        Size = fullWindow ? new Size(900, 750) : new Size(480, 590);
        MinimumSize = fullWindow ? new Size(600, 450) : Size;
        BackColor = Color.FromArgb(207, 214, 224);
        Padding = new Padding(1);

        var content = new TableLayoutPanel
        {
            Dock = DockStyle.Fill,
            BackColor = Color.White,
            Padding = new Padding(14),
            ColumnCount = 1,
            RowCount = 1,
        };
        content.RowStyles.Add(new RowStyle(SizeType.Percent, 100));
        runList = new FlowLayoutPanel();
        runList.Dock = fullWindow ? DockStyle.Fill : DockStyle.None;
        runList.FlowDirection = FlowDirection.TopDown;
        runList.WrapContents = false;
        runList.AutoScroll = fullWindow;
        runList.BackColor = Color.White;
        runList.Margin = Padding.Empty;
        if (fullWindow)
        {
            runList.Resize += (_, _) => ResizeCards();
            content.Controls.Add(runList, 0, 0);
        }
        else
        {
            viewport = new Panel
            {
                Dock = DockStyle.Fill,
                Margin = Padding.Empty,
            };
            overlayScrollBar = new OverlayScrollBar
            {
                Width = 10,
                Visible = false,
            };
            overlayScrollBar.ScrollRequested += offset =>
                SetScrollOffset(offset);
            viewport.Controls.Add(runList);
            viewport.Controls.Add(overlayScrollBar);
            runList.MouseWheel += OnFlyoutMouseWheel;
            viewport.MouseWheel += OnFlyoutMouseWheel;
            viewport.Resize += (_, _) =>
            {
                overlayScrollBar.Location = new Point(viewport.Width - 10, 0);
                overlayScrollBar.Height = viewport.Height;
                ResizeCards();
            };
            content.Controls.Add(viewport, 0, 0);
            scrollBarTimer = new System.Windows.Forms.Timer { Interval = 100 };
            scrollBarTimer.Tick += (_, _) => SyncOverlayScrollBar();
            VisibleChanged += (_, _) =>
            {
                if (Visible)
                {
                    scrollBarTimer.Start();
                }
                else
                {
                    scrollBarTimer.Stop();
                    overlayScrollBar.Visible = false;
                }
            };
            Disposed += (_, _) => scrollBarTimer.Dispose();
        }
        Controls.Add(content);
        Deactivate += (_, _) =>
        {
            if (flyoutMode && !deleting)
            {
                Hide();
            }
        };
    }

    /// <summary>Positions the flyout near the clicked notification icon.</summary>
    /// <param name="anchor">The click location in screen coordinates.</param>
    public void ShowAt(Point anchor)
    {
        flyoutMode = true;
        var workArea = Screen.FromPoint(anchor).WorkingArea;
        Location = new Point(
            Math.Clamp(
                anchor.X - Width + 40,
                workArea.Left,
                workArea.Right - Width
            ),
            Math.Clamp(
                anchor.Y - Height - 8,
                workArea.Top,
                workArea.Bottom - Height
            )
        );
        Show();
        UpdateFlyoutLayout();
        SetScrollOffset(runList.Height - viewport!.ClientSize.Height);
        Activate();
    }

    /// <summary>Selects the newest run each time the flyout is opened.</summary>
    public void SelectLatestRun()
    {
        userSelectedRun = false;
        expandedRunId = null;
    }

    /// <summary>Shows the same history in a resizable desktop window.</summary>
    public void ShowWindow()
    {
        Show();
        Activate();
    }

    /// <summary>Updates run cards and reads new logs for the open card.</summary>
    /// <param name="isBackgroundRunning">Whether the scheduled process is active.</param>
    /// <param name="runs">All retained runs, oldest first.</param>
    /// <returns>A task that completes after the flyout is refreshed.</returns>
    public async Task UpdateHistoryAsync(
        bool isBackgroundRunning,
        IReadOnlyList<JobRunSummary> runs
    )
    {
        backgroundRunning = isBackgroundRunning;
        var displayedRuns = fullWindow
            ? runs
            : JobRunHistoryDisplay.GetCompactRuns(runs);
        var latest = displayedRuns.Count == 0 ? null : displayedRuns[^1];

        var retainedIds = displayedRuns.Select(run => run.Id).ToHashSet();
        foreach (
            var id in cards
                .Keys.Where(id => !retainedIds.Contains(id))
                .ToArray()
        )
        {
            var removed = cards[id];
            runList.Controls.Remove(removed);
            removed.Dispose();
            cards.Remove(id);
        }

        foreach (var run in displayedRuns)
        {
            if (!cards.TryGetValue(run.Id, out var card))
            {
                card = new RunCard(run, fullWindow);
                card.Toggled += OnCardToggled;
                card.DeleteRequested += OnDeleteRequested;
                cards.Add(run.Id, card);
                runList.Controls.Add(card);
                if (!fullWindow)
                {
                    AttachFlyoutMouseWheel(card);
                }
            }

            card.UpdateSummary(
                run.Status == "Running"
                && (!isBackgroundRunning || run.Id != latest?.Id)
                    ? run with
                    {
                        Status = "Interrupted",
                    }
                    : run
            );
        }

        ResizeCards();
        if (
            !initialized
            || (
                expandedRunId is long selectedId
                && !cards.ContainsKey(selectedId)
            )
            || (!userSelectedRun && latest?.Id != expandedRunId)
        )
        {
            initialized = true;
            foreach (var card in cards.Values)
            {
                card.SetExpanded(false);
            }

            expandedRunId = latest?.Id;
            if (expandedRunId is long newestId)
            {
                cards[newestId].SetExpanded(true);
                if (fullWindow)
                {
                    runList.ScrollControlIntoView(cards[newestId]);
                }
                else
                {
                    UpdateFlyoutLayout();
                    SetScrollOffset(
                        cards[newestId].Bottom - viewport!.ClientSize.Height
                    );
                }
            }
        }

        UpdateFlyoutLayout();

        if (expandedRunId is long openId)
        {
            var card = cards[openId];
            card.AppendLogs(
                await history.GetLogsAsync(
                    openId,
                    card.LastLogId,
                    CancellationToken.None
                )
            );
        }
    }

    #region Private

    /// <summary>Opens only the clicked card and loads its saved logs.</summary>
    private async void OnCardToggled(object? sender, EventArgs eventArgs)
    {
        userSelectedRun = true;
        var selected = (RunCard)sender!;
        var shouldOpen = !selected.IsExpanded;
        foreach (var card in cards.Values)
        {
            card.SetExpanded(shouldOpen && card.Run.Id == selected.Run.Id);
        }

        expandedRunId = shouldOpen ? selected.Run.Id : null;
        UpdateFlyoutLayout();
        if (shouldOpen)
        {
            selected.AppendLogs(
                await history.GetLogsAsync(
                    selected.Run.Id,
                    selected.LastLogId,
                    CancellationToken.None
                )
            );
        }
    }

    /// <summary>Deletes the selected completed run and its log entries.</summary>
    private async void OnDeleteRequested(object? sender, EventArgs eventArgs)
    {
        var selected = (RunCard)sender!;
        deleting = true;
        try
        {
            var answer = MessageBox.Show(
                this,
                "Delete this run and all its logs?",
                "Delete run",
                MessageBoxButtons.YesNo,
                MessageBoxIcon.Question
            );
            if (answer == DialogResult.Yes)
            {
                await history.DeleteRunAsync(
                    selected.Run.Id,
                    CancellationToken.None
                );
                await UpdateHistoryAsync(
                    backgroundRunning,
                    await history.GetRunsAsync(CancellationToken.None)
                );
            }
        }
        finally
        {
            deleting = false;
        }
    }

    /// <summary>Keeps each accordion card within the flyout width.</summary>
    private void ResizeCards()
    {
        var width = fullWindow
            ? runList.ClientSize.Width
                - SystemInformation.VerticalScrollBarWidth
                - 2
            : viewport!.ClientSize.Width;
        foreach (var card in cards.Values)
        {
            if (card.Width != width)
            {
                card.Width = width;
            }
        }

        UpdateFlyoutLayout();
    }

    private void AttachFlyoutMouseWheel(Control control)
    {
        if (control is RichTextBox)
        {
            return;
        }

        control.MouseWheel += OnFlyoutMouseWheel;
        foreach (Control child in control.Controls)
        {
            AttachFlyoutMouseWheel(child);
        }
    }

    private void OnFlyoutMouseWheel(object? sender, MouseEventArgs eventArgs)
    {
        SetScrollOffset(
            scrollOffset - (int)Math.Round(eventArgs.Delta / 120d * 60)
        );
    }

    private void SetScrollOffset(int offset)
    {
        scrollOffset = Math.Clamp(
            offset,
            0,
            Math.Max(0, runList.Height - viewport!.ClientSize.Height)
        );
        runList.Top = -scrollOffset;
        SyncOverlayScrollBar();
    }

    private void UpdateFlyoutLayout()
    {
        if (viewport is null)
        {
            return;
        }

        var contentHeight = runList
            .Controls.Cast<Control>()
            .Sum(control => control.Height + control.Margin.Vertical);
        runList.Size = new Size(viewport.ClientSize.Width, contentHeight);
        runList.PerformLayout();
        SetScrollOffset(scrollOffset);
    }

    private void SyncOverlayScrollBar()
    {
        if (overlayScrollBar is null)
        {
            return;
        }

        var contentHeight = runList.Height;
        overlayScrollBar.SetMetrics(
            contentHeight,
            viewport!.ClientSize.Height,
            scrollOffset
        );
        var visible =
            Visible
            && Bounds.Contains(Cursor.Position)
            && contentHeight > viewport.ClientSize.Height;
        if (overlayScrollBar.Visible != visible)
        {
            overlayScrollBar.Visible = visible;
        }
    }

    private sealed class OverlayScrollBar : Control
    {
        private int maximumOffset;
        private int offset;
        private int contentHeight;
        private bool dragging;
        private int dragStartY;
        private int dragStartOffset;

        public event Action<int>? ScrollRequested;

        public void SetMetrics(
            int contentHeight,
            int viewportHeight,
            int offset
        )
        {
            var maximum = Math.Max(0, contentHeight - viewportHeight);
            var current = Math.Clamp(offset, 0, maximum);
            if (
                this.contentHeight != contentHeight
                || maximumOffset != maximum
                || this.offset != current
            )
            {
                this.contentHeight = contentHeight;
                maximumOffset = maximum;
                this.offset = current;
                Invalidate();
            }
        }

        protected override void OnPaint(PaintEventArgs eventArgs)
        {
            eventArgs.Graphics.Clear(Color.White);
            if (maximumOffset == 0)
            {
                return;
            }

            using var track = new SolidBrush(Color.FromArgb(241, 245, 249));
            using var thumb = new SolidBrush(Color.FromArgb(100, 116, 139));
            eventArgs.Graphics.FillRectangle(track, 2, 0, 6, Height);
            eventArgs.Graphics.FillRectangle(thumb, 2, ThumbY, 6, ThumbHeight);
        }

        protected override void OnMouseDown(MouseEventArgs eventArgs)
        {
            base.OnMouseDown(eventArgs);
            dragging = true;
            Capture = true;
            dragStartY = eventArgs.Y;
            dragStartOffset = offset;
            if (eventArgs.Y < ThumbY || eventArgs.Y > ThumbY + ThumbHeight)
            {
                RequestOffset(eventArgs.Y - ThumbHeight / 2);
                dragStartOffset = offset;
            }
        }

        protected override void OnMouseMove(MouseEventArgs eventArgs)
        {
            base.OnMouseMove(eventArgs);
            if (dragging)
            {
                RequestOffset(dragStartOffset, eventArgs.Y - dragStartY);
            }
        }

        protected override void OnMouseUp(MouseEventArgs eventArgs)
        {
            base.OnMouseUp(eventArgs);
            dragging = false;
            Capture = false;
        }

        protected override void OnMouseWheel(MouseEventArgs eventArgs)
        {
            base.OnMouseWheel(eventArgs);
            ScrollRequested?.Invoke(
                Math.Clamp(
                    offset - eventArgs.Delta / 120 * 60,
                    0,
                    maximumOffset
                )
            );
        }

        private int ThumbHeight =>
            Math.Clamp(Height * Height / contentHeight, 32, Height);

        private int ThumbY => (Height - ThumbHeight) * offset / maximumOffset;

        private void RequestOffset(int thumbY)
        {
            ScrollRequested?.Invoke(
                Math.Clamp(
                    thumbY * maximumOffset / (Height - ThumbHeight),
                    0,
                    maximumOffset
                )
            );
        }

        private void RequestOffset(int startOffset, int deltaY)
        {
            ScrollRequested?.Invoke(
                Math.Clamp(
                    startOffset
                        + deltaY * maximumOffset / (Height - ThumbHeight),
                    0,
                    maximumOffset
                )
            );
        }
    }

    #endregion
}
