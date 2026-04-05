namespace Petshop.Api.Entities.Accounting;

public enum AccountingDispatchRunStatus
{
    Pending = 0,
    Processing = 1,
    Succeeded = 2,
    PartialFailed = 3,
    Failed = 4,
    Skipped = 5
}
