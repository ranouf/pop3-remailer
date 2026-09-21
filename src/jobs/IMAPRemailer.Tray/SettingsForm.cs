using IMAPRemailer.Core.Email.Configuration;

namespace IMAPRemailer.Tray;

/// <summary>Lets the user replace the file's schedule and batch size.</summary>
public sealed class SettingsForm : Form
{
    private readonly ComboBox interval;
    private readonly ComboBox maximum;

    public SettingsForm(JobSettings defaults, JobOverrides overrides)
    {
        Text = "Paramètres · IMAP Remailer";
        ClientSize = new Size(560, 335);
        FormBorderStyle = FormBorderStyle.FixedDialog;
        StartPosition = FormStartPosition.CenterScreen;
        MaximizeBox = false;
        MinimizeBox = false;
        ShowInTaskbar = false;
        BackColor = Color.White;
        Font = new Font("Segoe UI", 9);
        Icon = Icon.ExtractAssociatedIcon(Application.ExecutablePath);

        var title = new Label
        {
            Text = "Paramètres de synchronisation",
            Font = new Font("Segoe UI", 15, FontStyle.Bold),
            ForeColor = Color.FromArgb(31, 41, 55),
            Location = new Point(24, 18),
            Size = new Size(512, 34),
        };
        var description = new Label
        {
            Text =
                "Choisis les valeurs à utiliser pour les prochaines exécutions.",
            ForeColor = Color.FromArgb(75, 85, 99),
            Location = new Point(24, 57),
            Size = new Size(512, 36),
        };
        var intervalLabel = new Label
        {
            Text = "Fréquence d'exécution",
            Font = new Font("Segoe UI", 9, FontStyle.Bold),
            Location = new Point(24, 101),
            AutoSize = true,
        };
        interval = new ComboBox
        {
            DropDownStyle = ComboBoxStyle.DropDownList,
            Location = new Point(24, 127),
            Size = new Size(512, 32),
        };
        var cronMinute = defaults.Cron.Split(' ')[1];
        var defaultInterval =
            cronMinute.StartsWith("*/", StringComparison.Ordinal)
                ? $"{cronMinute[2..]} min"
            : defaults.Cron == "0 0 * * * *" ? "60 min"
            : defaults.Cron;
        interval.Items.Add(new Choice($"Par défaut ({defaultInterval})", null));
        foreach (var minutes in new[] { 1, 2, 5, 10, 15, 20, 30, 60 })
        {
            interval.Items.Add(
                new Choice(
                    minutes == 1
                        ? "Chaque minute"
                        : $"Toutes les {minutes} minutes",
                    minutes
                )
            );
        }
        interval.SelectedItem = interval
            .Items.Cast<Choice>()
            .First(choice => choice.Value == overrides.IntervalMinutes);

        var maximumLabel = new Label
        {
            Text = "Courriels par exécution",
            Font = new Font("Segoe UI", 9, FontStyle.Bold),
            Location = new Point(24, 175),
            AutoSize = true,
        };
        maximum = new ComboBox
        {
            DropDownStyle = ComboBoxStyle.DropDownList,
            Location = new Point(24, 201),
            Size = new Size(512, 32),
        };
        maximum.Items.Add(
            new Choice($"Par défaut ({defaults.MaxMessagesPerRun})", null)
        );
        foreach (var count in new[] { 5, 10, 15, 20, 50, 100 })
        {
            maximum.Items.Add(new Choice($"{count} courriels", count));
        }
        maximum.SelectedItem = maximum
            .Items.Cast<Choice>()
            .First(choice => choice.Value == overrides.MaxMessagesPerRun);

        var note = new Label
        {
            Text = "Les changements s'appliquent sans redémarrage.",
            ForeColor = Color.FromArgb(75, 85, 99),
            Location = new Point(24, 248),
            Size = new Size(512, 25),
        };
        var cancel = new Button
        {
            Text = "Annuler",
            DialogResult = DialogResult.Cancel,
            Location = new Point(288, 284),
            Size = new Size(112, 32),
        };
        var save = new Button
        {
            Text = "Enregistrer",
            DialogResult = DialogResult.OK,
            Location = new Point(408, 284),
            Size = new Size(128, 32),
            FlatStyle = FlatStyle.Flat,
            BackColor = Color.FromArgb(37, 99, 235),
            ForeColor = Color.White,
        };
        save.FlatAppearance.BorderSize = 0;
        AcceptButton = save;
        CancelButton = cancel;
        Controls.AddRange([
            title,
            description,
            intervalLabel,
            interval,
            maximumLabel,
            maximum,
            note,
            cancel,
            save,
        ]);
    }

    public JobOverrides SelectedOverrides =>
        new(
            ((Choice)interval.SelectedItem!).Value,
            ((Choice)maximum.SelectedItem!).Value
        );

    private sealed record Choice(string Text, int? Value)
    {
        public override string ToString() => Text;
    }
}
