using IMAPRemailer.Core.Email;
using IMAPRemailer.Core.Email.Configuration;

namespace IMAPRemailer.Jobs.Tests.Fakes;

public sealed class FakeJobOverridesStore : IJobOverridesStore
{
    public JobOverrides Current { get; set; } = new(null, null);

    public Task<JobOverrides> GetAsync(CancellationToken cancellationToken) =>
        Task.FromResult(Current);

    public Task SaveAsync(
        JobOverrides values,
        CancellationToken cancellationToken
    )
    {
        Current = values;
        return Task.CompletedTask;
    }
}
