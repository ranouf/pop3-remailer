using IMAPRemailer.Core.Email.Configuration;

namespace IMAPRemailer.Core.Email;

/// <summary>Shares user scheduling choices between the tray and background job.</summary>
public interface IJobOverridesStore
{
    Task<JobOverrides> GetAsync(CancellationToken cancellationToken);

    Task SaveAsync(JobOverrides values, CancellationToken cancellationToken);
}
