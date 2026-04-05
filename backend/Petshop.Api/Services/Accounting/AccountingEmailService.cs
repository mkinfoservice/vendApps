using System.Net;
using System.Net.Mail;
using Microsoft.Extensions.Options;

namespace Petshop.Api.Services.Accounting;

public sealed class AccountingEmailService
{
    private readonly AccountingMailSettings _settings;

    public AccountingEmailService(IOptions<AccountingMailSettings> settings)
    {
        _settings = settings.Value;
    }

    public async Task SendAsync(
        AccountingEmailMessage message,
        IReadOnlyList<GeneratedAttachment> attachments,
        CancellationToken ct)
    {
        ValidateSettings();

        using var mail = new MailMessage
        {
            From = new MailAddress(_settings.FromEmail!, _settings.FromName ?? "vendApps"),
            Subject = message.Subject,
            Body = message.Body,
            IsBodyHtml = false
        };

        mail.To.Add(new MailAddress(message.PrimaryEmail));
        foreach (var cc in message.CcEmails)
            mail.CC.Add(new MailAddress(cc));

        var attachmentStreams = new List<MemoryStream>();
        try
        {
            foreach (var item in attachments)
            {
                var ms = new MemoryStream(item.Content);
                attachmentStreams.Add(ms);
                var attach = new Attachment(ms, item.FileName, GetContentType(item.FileName));
                mail.Attachments.Add(attach);
            }

            using var smtp = new SmtpClient(_settings.Host!, _settings.Port)
            {
                EnableSsl = _settings.EnableSsl,
                DeliveryMethod = SmtpDeliveryMethod.Network,
                UseDefaultCredentials = false,
                Credentials = string.IsNullOrWhiteSpace(_settings.Username)
                    ? CredentialCache.DefaultNetworkCredentials
                    : new NetworkCredential(_settings.Username, _settings.Password)
            };

            ct.ThrowIfCancellationRequested();
            await smtp.SendMailAsync(mail);
        }
        finally
        {
            foreach (var stream in attachmentStreams)
                stream.Dispose();
        }
    }

    public async Task SendTestAsync(string recipientEmail, string body, CancellationToken ct)
    {
        await SendAsync(
            new AccountingEmailMessage(
                recipientEmail,
                [],
                "Teste de envio contabil - vendApps",
                body),
            [],
            ct);
    }

    private void ValidateSettings()
    {
        if (string.IsNullOrWhiteSpace(_settings.Host))
            throw new InvalidOperationException("SMTP host nao configurado (AccountingDispatch:Smtp:Host).");
        if (_settings.Port <= 0)
            throw new InvalidOperationException("SMTP port invalido (AccountingDispatch:Smtp:Port).");
        if (string.IsNullOrWhiteSpace(_settings.FromEmail))
            throw new InvalidOperationException("SMTP from nao configurado (AccountingDispatch:Smtp:FromEmail).");
    }

    private static string GetContentType(string fileName)
    {
        var ext = Path.GetExtension(fileName).ToLowerInvariant();
        return ext switch
        {
            ".zip" => "application/zip",
            ".csv" => "text/csv",
            ".pdf" => "application/pdf",
            _ => "application/octet-stream"
        };
    }
}

public sealed record AccountingEmailMessage(
    string PrimaryEmail,
    IReadOnlyList<string> CcEmails,
    string Subject,
    string Body);

public sealed class AccountingMailSettings
{
    public string? Host { get; set; }
    public int Port { get; set; } = 587;
    public string? Username { get; set; }
    public string? Password { get; set; }
    public string? FromEmail { get; set; }
    public string? FromName { get; set; }
    public bool EnableSsl { get; set; } = true;
}
