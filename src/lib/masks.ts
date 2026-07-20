export function onlyDigits(value: string): string {
  return value.replace(/\D+/g, "");
}

export function maskCpf(value: string): string {
  const d = onlyDigits(value).slice(0, 11);
  return d
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d{1,2})$/, "$1-$2");
}

export function maskCelular(value: string): string {
  const d = onlyDigits(value).slice(0, 11);
  return d
    .replace(/(\d{2})(\d)/, "($1) $2")
    .replace(/(\d{5})(\d{1,4})$/, "$1-$2");
}

export function maskCep(value: string): string {
  const d = onlyDigits(value).slice(0, 8);
  return d.replace(/(\d{5})(\d{1,3})$/, "$1-$2");
}

export function maskCardNumber(value: string): string {
  const d = onlyDigits(value).slice(0, 19);
  return d.replace(/(\d{4})(?=\d)/g, "$1 ").trim();
}

export function maskCardExpiry(value: string): string {
  const d = onlyDigits(value).slice(0, 4);
  if (d.length <= 2) return d;
  return `${d.slice(0, 2)}/${d.slice(2)}`;
}

export function maskCvv(value: string, maxLength = 4): string {
  return onlyDigits(value).slice(0, maxLength);
}

export function getCardBrand(value: string): string | null {
  const n = onlyDigits(value);
  if (!n) return null;
  if (/^3[47]/.test(n)) return "AMEX";
  if (/^(6011|65|644|645|646|647|648|649|622)/.test(n)) return "DISCOVER";
  if (/^(4011|4312|4389|4514|4576|5041|5066|5067|509|6277|6362|6363|650|6516|6550)/.test(n)) return "ELO";
  if (/^4/.test(n)) return "VISA";
  if (/^(5[1-5]|2[2-7])/.test(n)) return "MASTERCARD";
  return null;
}

export function cvvLengthForBrand(brand: string | null): number {
  return brand === "AMEX" ? 4 : 3;
}

export function isValidLuhn(value: string): boolean {
  const d = onlyDigits(value);
  if (d.length < 13) return false;
  let sum = 0;
  let alt = false;
  for (let i = d.length - 1; i >= 0; i--) {
    let n = parseInt(d[i], 10);
    if (alt) {
      n *= 2;
      if (n > 9) n -= 9;
    }
    sum += n;
    alt = !alt;
  }
  return sum % 10 === 0;
}

export function isCardExpired(expiry: string): boolean {
  const d = onlyDigits(expiry);
  if (d.length !== 4) return true;
  const mm = parseInt(d.slice(0, 2), 10);
  const yy = parseInt(d.slice(2), 10);
  if (mm < 1 || mm > 12 || isNaN(yy)) return true;
  const now = new Date();
  const minDate = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  const expDate = new Date(2000 + yy, mm - 1, 1);
  return expDate < minDate;
}

export function cpfIsValid(value: string): boolean {
  const d = onlyDigits(value);
  if (d.length !== 11 || /^(\d)\1{10}$/.test(d)) return false;
  let sum = 0;
  for (let i = 0; i < 9; i++) sum += parseInt(d[i], 10) * (10 - i);
  let rev = 11 - (sum % 11);
  if (rev >= 10) rev = 0;
  if (rev !== parseInt(d[9], 10)) return false;
  sum = 0;
  for (let i = 0; i < 10; i++) sum += parseInt(d[i], 10) * (11 - i);
  rev = 11 - (sum % 11);
  if (rev >= 10) rev = 0;
  return rev === parseInt(d[10], 10);
}