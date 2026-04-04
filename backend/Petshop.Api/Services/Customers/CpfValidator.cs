namespace Petshop.Api.Services.Customers;

public static class CpfValidator
{
    public static string? Normalize(string? cpf)
    {
        if (string.IsNullOrWhiteSpace(cpf)) return null;
        var digits = new string(cpf.Where(char.IsDigit).ToArray());
        return string.IsNullOrWhiteSpace(digits) ? null : digits;
    }

    public static bool IsValid(string? cpf)
    {
        var digits = Normalize(cpf);
        if (digits is null || digits.Length != 11) return false;
        if (digits.Distinct().Count() == 1) return false;

        var firstDigit = CalculateCheckDigit(digits, 9, 10);
        if (firstDigit != (digits[9] - '0')) return false;

        var secondDigit = CalculateCheckDigit(digits, 10, 11);
        return secondDigit == (digits[10] - '0');
    }

    private static int CalculateCheckDigit(string digits, int count, int weightStart)
    {
        var sum = 0;
        for (var i = 0; i < count; i++)
            sum += (digits[i] - '0') * (weightStart - i);

        var remainder = sum % 11;
        return remainder < 2 ? 0 : 11 - remainder;
    }
}
