export function digitsOnly(value: string) {
  return value.replace(/\D/g, "");
}

export function formatCpf(value: string) {
  const d = digitsOnly(value).slice(0, 11);
  if (d.length <= 3) return d;
  if (d.length <= 6) return `${d.slice(0, 3)}.${d.slice(3)}`;
  if (d.length <= 9) return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6)}`;
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
}

export function isValidCpf(value: string) {
  const cpf = digitsOnly(value);
  if (cpf.length !== 11) return false;
  if (/^(\d)\1{10}$/.test(cpf)) return false;

  const calcDigit = (count: number, weightStart: number) => {
    let sum = 0;
    for (let i = 0; i < count; i += 1)
      sum += Number(cpf[i]) * (weightStart - i);
    const remainder = sum % 11;
    return remainder < 2 ? 0 : 11 - remainder;
  };

  const first = calcDigit(9, 10);
  if (first !== Number(cpf[9])) return false;
  const second = calcDigit(10, 11);
  return second === Number(cpf[10]);
}
