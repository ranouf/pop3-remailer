using IMAPRemailer.Core.Email;

namespace IMAPRemailer.Jobs.Tests.Email;

public sealed class RunLogContext_Tests
{
    [Fact]
    public void Begin_Should_Restore_Previous_Run_After_Nested_Scopes()
    {
        var context = new RunLogContext();
        Assert.Null(context.CurrentRunId);

        using (context.Begin(10))
        {
            Assert.Equal(10, context.CurrentRunId);
            using (context.Begin(11))
            {
                Assert.Equal(11, context.CurrentRunId);
            }

            Assert.Equal(10, context.CurrentRunId);
        }

        Assert.Null(context.CurrentRunId);
    }
}
