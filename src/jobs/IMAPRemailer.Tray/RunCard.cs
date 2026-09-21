using System.Drawing.Drawing2D;
using System.Globalization;
using IMAPRemailer.Core.Email.Models;

namespace IMAPRemailer.Tray;

/// <summary>Shows one run as a collapsible header, metrics, and colored logs.</summary>
public sealed class RunCard : UserControl
{
    private readonly RunHeaderButton header;
    private readonly Panel metrics;
    private readonly Label readMetric;
    private readonly Label sentMetric;
    private readonly Label presentMetric;
    private readonly Label pendingMetric;
    private readonly Label durationMetric;
    private readonly Label statusMetric;
    private readonly ToolTip metricToolTip = new();
    private readonly Label errorLabel;
    private readonly RichTextBox logs;
    private readonly Button deleteButton;
    private readonly Panel details;
    private bool followTail = true;
    private bool updatingLogs;
    private bool expanded;
    private bool hasErrorLog;

    /// <summary>Creates a card for one persisted run.</summary>
    /// <param name="run">The initial run summary.</param>
    /// <param name="fullWindow">Whether to reserve more space for logs.</param>
    public RunCard(JobRunSummary run, bool fullWindow = false)
    {
        Run = run;
        Width = 440;
        Height = 72;
        Margin = new Padding(0, 0, 0, 10);
        BackColor = Color.White;

        header = new RunHeaderButton
        {
            Dock = DockStyle.Top,
            Height = 72,
            Cursor = Cursors.Hand,
        };
        header.Click += (_, _) => Toggled?.Invoke(this, EventArgs.Empty);

        details = new Panel
        {
            Dock = DockStyle.Top,
            Height = fullWindow ? 440 : 292,
            Visible = false,
            Padding = new Padding(10, 8, 10, 8),
        };
        metrics = new Panel { Dock = DockStyle.Top, Height = 52 };
        var firstRow = new FlowLayoutPanel
        {
            Dock = DockStyle.Top,
            Height = 26,
            WrapContents = false,
        };
        var secondRow = new FlowLayoutPanel
        {
            Dock = DockStyle.Bottom,
            Height = 26,
            WrapContents = false,
        };
        readMetric = AddMetric(
            firstRow,
            "Messages lus dans la boîte Orange pendant cette exécution."
        );
        sentMetric = AddMetric(
            firstRow,
            "Messages transférés vers Gmail pendant cette exécution."
        );
        presentMetric = AddMetric(
            firstRow,
            "Messages déjà confirmés dans la base locale ou trouvés dans Gmail; aucun nouveau transfert nécessaire."
        );
        pendingMetric = AddMetric(
            firstRow,
            "Messages à transférer lors d'une prochaine exécution; en mode simulation, aucun transfert n'est effectué."
        );
        durationMetric = AddMetric(
            secondRow,
            "Temps écoulé pour cette exécution."
        );
        statusMetric = AddMetric(secondRow, "État de cette exécution.");
        metrics.Controls.Add(secondRow);
        metrics.Controls.Add(firstRow);
        errorLabel = new Label
        {
            Dock = DockStyle.Top,
            Height = 0,
            Font = new Font("Segoe UI", 8.5f),
            ForeColor = Color.Firebrick,
        };
        logs = new RichTextBox
        {
            Dock = DockStyle.Fill,
            ReadOnly = true,
            BorderStyle = BorderStyle.FixedSingle,
            BackColor = Color.White,
            ForeColor = Color.Black,
            Font = new Font("Consolas", 8.5f),
            WordWrap = true,
            DetectUrls = false,
            ScrollBars = RichTextBoxScrollBars.Vertical,
        };
        logs.VScroll += (_, _) =>
        {
            if (!updatingLogs)
            {
                followTail = false;
            }
        };
        logs.MouseWheel += (_, _) => followTail = false;
        deleteButton = new Button
        {
            Dock = DockStyle.Bottom,
            Height = 30,
            Text = "Delete run",
            FlatStyle = FlatStyle.Flat,
            ForeColor = Color.Firebrick,
            BackColor = Color.White,
            Font = new Font("Segoe UI", 8),
        };
        deleteButton.Click += (_, _) =>
            DeleteRequested?.Invoke(this, EventArgs.Empty);

        details.Controls.Add(logs);
        details.Controls.Add(errorLabel);
        details.Controls.Add(metrics);
        details.Controls.Add(deleteButton);
        Controls.Add(details);
        Controls.Add(header);
        UpdateSummary(run);
    }

    /// <summary>Raised when the card header is clicked.</summary>
    public event EventHandler? Toggled;

    /// <summary>Raised when the user requests deletion of this run.</summary>
    public event EventHandler? DeleteRequested;

    /// <summary>Gets the run represented by this card.</summary>
    public JobRunSummary Run { get; private set; }

    /// <summary>Gets the latest log identifier already displayed.</summary>
    public long LastLogId { get; private set; }

    /// <summary>Gets whether the details are expanded.</summary>
    public bool IsExpanded => expanded;

    /// <summary>Updates header status and the saved run metrics.</summary>
    /// <param name="run">The latest persisted summary.</param>
    public void UpdateSummary(JobRunSummary run)
    {
        Run = run;
        var status = run.Status switch
        {
            "Running" => "In progress",
            "Failed" => "Failed",
            "Interrupted" => "Interrupted",
            _ => "Completed",
        };
        var duration =
            run.Status == "Interrupted" ? "—"
            : run.DurationMs is null
                ? $"{(DateTimeOffset.UtcNow - run.StartedAtUtc).TotalSeconds:0.0} s"
            : $"{run.DurationMs.Value / 1000:0.0} s";
        var hasError = run.Status is "Failed" or "Interrupted" || hasErrorLog;
        var date = run
            .StartedAtUtc.ToLocalTime()
            .ToString("dd/MM/yyyy HH:mm", CultureInfo.InvariantCulture);
        var alreadyInGmail =
            run.AlreadyPresent > 0
                ? $"  ·  {run.AlreadyPresent} already in Gmail"
                : "";
        var pending = run.Pending > 0 ? $"  ·  {run.Pending} pending" : "";
        var summary =
            $"{run.SourceCount} read  ·  {run.Imported} transferred{alreadyInGmail}{pending}  ·  {duration}{(run.DryRun ? "  ·  dry run" : "")}";
        header.SetContent(
            date,
            status,
            summary,
            hasError,
            run.Status == "Running",
            expanded
        );
        readMetric.Text = $"Read: {run.SourceCount}";
        sentMetric.Text = $"Sent: {run.Imported}";
        presentMetric.Text = $"Present: {run.AlreadyPresent}";
        pendingMetric.Text = $"Pending: {run.Pending}";
        durationMetric.Text = $"Duration: {duration}";
        statusMetric.Text = $"Status: {status}";
        errorLabel.Text = run.Error is null ? "" : $"Error: {run.Error}";
        errorLabel.Height = run.Error is null ? 0 : 38;
        deleteButton.Enabled = run.Status != "Running";
    }

    private Label AddMetric(FlowLayoutPanel row, string description)
    {
        var label = new Label
        {
            AutoSize = true,
            Font = new Font("Segoe UI", 8.5f),
            ForeColor = Color.FromArgb(55, 65, 81),
            Margin = new Padding(0, 0, 18, 0),
            Padding = new Padding(0, 3, 0, 0),
        };
        metricToolTip.SetToolTip(label, description);
        row.Controls.Add(label);
        return label;
    }

    /// <summary>Shows or hides metrics and logs.</summary>
    /// <param name="expanded">Whether the details should be visible.</param>
    public void SetExpanded(bool expanded)
    {
        this.expanded = expanded;
        details.Visible = expanded;
        Height = expanded ? header.Height + details.Height : header.Height;
        if (expanded)
        {
            followTail = true;
        }

        UpdateSummary(Run);
    }

    /// <summary>Appends new log entries with colors determined by their levels.</summary>
    /// <param name="entries">The entries to add in write order.</param>
    public void AppendLogs(IReadOnlyList<JobRunLog> entries)
    {
        if (entries.Count == 0)
        {
            return;
        }

        updatingLogs = true;
        var selectionStart = logs.SelectionStart;
        var selectionLength = logs.SelectionLength;
        var firstVisibleLine = NativeScroll.GetFirstVisibleLine(logs.Handle);
        foreach (var entry in entries)
        {
            if (entry.Level is "Error" or "Critical")
            {
                hasErrorLog = true;
            }

            logs.SelectionStart = logs.TextLength;
            logs.SelectionLength = 0;
            logs.SelectionColor = entry.Level switch
            {
                "Warning" => Color.FromArgb(180, 95, 0),
                "Error" or "Critical" => Color.Firebrick,
                _ => Color.Black,
            };
            logs.AppendText(
                $"{entry.OccurredAtUtc.ToLocalTime().ToString("HH:mm:ss.fff", CultureInfo.InvariantCulture)} "
                    + $"{entry.Level}: {entry.Message}{Environment.NewLine}"
            );
            LastLogId = entry.Id;
        }

        if (followTail)
        {
            logs.SelectionStart = logs.TextLength;
            logs.ScrollToCaret();
        }
        else
        {
            logs.SelectionStart = selectionStart;
            logs.SelectionLength = selectionLength;
            NativeScroll.SetFirstVisibleLine(logs.Handle, firstVisibleLine);
        }

        updatingLogs = false;
        UpdateSummary(Run);
    }

    protected override void Dispose(bool disposing)
    {
        if (disposing)
        {
            metricToolTip.Dispose();
        }

        base.Dispose(disposing);
    }

    private sealed class RunHeaderButton : Button
    {
        private readonly Font dateFont = new("Segoe UI", 9.5f, FontStyle.Bold);
        private readonly Font statusFont = new("Segoe UI", 8, FontStyle.Bold);
        private readonly Font summaryFont = new("Segoe UI", 8.5f);
        private string date = "";
        private string status = "";
        private string summary = "";
        private bool hasError;
        private bool running;
        private bool expanded;
        private bool hovered;

        public RunHeaderButton()
        {
            SetStyle(
                ControlStyles.UserPaint
                    | ControlStyles.AllPaintingInWmPaint
                    | ControlStyles.OptimizedDoubleBuffer,
                true
            );
        }

        public void SetContent(
            string date,
            string status,
            string summary,
            bool hasError,
            bool running,
            bool expanded
        )
        {
            this.date = date;
            this.status = status;
            this.summary = summary;
            this.hasError = hasError;
            this.running = running;
            this.expanded = expanded;
            AccessibleName = $"{date}, {status}, {summary}";
            Invalidate();
        }

        protected override void OnMouseEnter(EventArgs eventArgs)
        {
            base.OnMouseEnter(eventArgs);
            hovered = true;
            Invalidate();
        }

        protected override void OnMouseLeave(EventArgs eventArgs)
        {
            base.OnMouseLeave(eventArgs);
            hovered = false;
            Invalidate();
        }

        protected override void OnPaint(PaintEventArgs eventArgs)
        {
            var background =
                hovered ? Color.FromArgb(241, 245, 249)
                : expanded ? Color.FromArgb(239, 246, 255)
                : Color.FromArgb(248, 250, 252);
            eventArgs.Graphics.Clear(background);
            using var border = new Pen(
                expanded
                    ? Color.FromArgb(147, 197, 253)
                    : Color.FromArgb(203, 213, 225)
            );
            eventArgs.Graphics.DrawRectangle(
                border,
                0,
                0,
                Width - 1,
                Height - 1
            );

            var textFlags =
                TextFormatFlags.VerticalCenter
                | TextFormatFlags.EndEllipsis
                | TextFormatFlags.NoPrefix;
            TextRenderer.DrawText(
                eventArgs.Graphics,
                date,
                dateFont,
                new Rectangle(16, 10, Width - 166, 25),
                Color.FromArgb(31, 41, 55),
                textFlags
            );
            TextRenderer.DrawText(
                eventArgs.Graphics,
                summary,
                summaryFont,
                new Rectangle(16, 39, Width - 56, 22),
                Color.FromArgb(75, 85, 99),
                textFlags
            );

            var badge = new Rectangle(Width - 132, 11, 92, 24);
            var badgeBackground =
                hasError ? Color.FromArgb(254, 226, 226)
                : running ? Color.FromArgb(219, 234, 254)
                : Color.FromArgb(220, 252, 231);
            var badgeText =
                hasError ? Color.FromArgb(153, 27, 27)
                : running ? Color.FromArgb(30, 64, 175)
                : Color.FromArgb(22, 101, 52);
            using var badgeBrush = new SolidBrush(badgeBackground);
            eventArgs.Graphics.FillRectangle(badgeBrush, badge);
            TextRenderer.DrawText(
                eventArgs.Graphics,
                status,
                statusFont,
                badge,
                badgeText,
                textFlags | TextFormatFlags.HorizontalCenter
            );

            eventArgs.Graphics.SmoothingMode = SmoothingMode.AntiAlias;
            using var chevronPen = new Pen(Color.FromArgb(51, 65, 85), 2.5f)
            {
                StartCap = LineCap.Round,
                EndCap = LineCap.Round,
                LineJoin = LineJoin.Round,
            };
            var centerX = Width - 21;
            var centerY = 36;
            var points = expanded
                ? new[]
                {
                    new Point(centerX - 6, centerY + 3),
                    new Point(centerX, centerY - 3),
                    new Point(centerX + 6, centerY + 3),
                }
                : new[]
                {
                    new Point(centerX - 6, centerY - 3),
                    new Point(centerX, centerY + 3),
                    new Point(centerX + 6, centerY - 3),
                };
            eventArgs.Graphics.DrawLines(chevronPen, points);

            if (Focused)
            {
                ControlPaint.DrawFocusRectangle(
                    eventArgs.Graphics,
                    new Rectangle(3, 3, Width - 6, Height - 6)
                );
            }
        }

        protected override void Dispose(bool disposing)
        {
            if (disposing)
            {
                dateFont.Dispose();
                statusFont.Dispose();
                summaryFont.Dispose();
            }

            base.Dispose(disposing);
        }
    }
}
