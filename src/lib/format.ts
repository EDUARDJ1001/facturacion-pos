/** L1,234.56 (sin Intl para no depender del soporte de Hermes en equipos viejos). */
export function money(value: number) {
  const fixed = Math.abs(round2(value)).toFixed(2);
  const [integer, decimals] = fixed.split('.');
  const grouped = integer.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return `${value < 0 ? '-' : ''}L${grouped}.${decimals}`;
}

export function round2(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

/** Cantidad sin ceros sobrantes: 2, 1.5, 0.25 */
export function quantity(value: number) {
  return String(round2(value));
}

const pad = (value: number) => String(value).padStart(2, '0');

/** "2026-10-12" o ISO → 12/10/2026 (las fechas solo-día se toman tal cual, sin zona horaria). */
export function shortDate(value: string | null | undefined) {
  if (!value) {
    return '';
  }
  const match = String(value).match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (match) {
    return `${match[3]}/${match[2]}/${match[1]}`;
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? String(value) : `${pad(date.getDate())}/${pad(date.getMonth() + 1)}/${date.getFullYear()}`;
}

export function dateTime(value: string | null | undefined) {
  if (!value) {
    return '';
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return String(value);
  }
  return `${shortDate(value)} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/** Rango autorizado con el prefijo de la factura (000-001-01-), igual que la factura impresa. */
export function authorizedRange(invoiceNumber: string, start: number, end: number) {
  const prefix = invoiceNumber.match(/^(\d{3}-\d{3}-\d{2}-)/)?.[1] ?? '';
  return `${prefix}${String(start).padStart(8, '0')} al ${prefix}${String(end).padStart(8, '0')}`;
}

/** Precio con ISV para mostrar en pantalla (el backend guarda precios sin impuesto). */
export function priceWithTax(price: number, taxRate: number, taxable: boolean) {
  return round2(price * (1 + (taxable ? taxRate : 0) / 100));
}
