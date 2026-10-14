import type { Align, PrintCommand } from '../../modules/senraise-printer';
import { authorizedRange, dateTime, money, quantity, shortDate } from './format';
import type { InvoiceDetail, TenderMethod } from './types';

/**
 * Ticket de 58 mm (384 puntos). Un solo modelo de líneas que se imprime en la Senraise
 * y se muestra como vista previa en pantalla.
 */
export type TicketSize = 'sm' | 'md' | 'lg';

export type TicketLine =
  | { kind: 'text'; text: string; align?: 'left' | 'center' | 'right'; bold?: boolean; size?: TicketSize }
  | { kind: 'row'; left: string; right: string; bold?: boolean; size?: TicketSize }
  | { kind: 'divider' }
  | { kind: 'feed'; lines: number };

/** Tamaños de letra del servicio Senraise (en puntos de la impresora). Ajustables tras probar. */
export const PRINTER_TEXT_SIZE: Record<TicketSize, number> = { sm: 20, md: 24, lg: 32 };

/** Caracteres por línea aproximados con letra "md" en papel de 58 mm (para la vista previa). */
export const TICKET_COLUMNS = 32;

export interface PaymentInfo {
  method: TenderMethod;
  received?: number;
  change?: number;
  /** Cobro con tarjeta simulado por NFC (modo prueba). */
  simulated?: boolean;
}

const TENDER_LABEL: Record<TenderMethod, string> = {
  EFECTIVO: 'Efectivo',
  TARJETA: 'Tarjeta',
  TRANSFERENCIA: 'Transferencia',
  CHEQUE: 'Cheque',
  OTRO: 'Otro',
};

export function buildInvoiceTicket(invoice: InvoiceDetail, payment?: PaymentInfo, copy = false): TicketLine[] {
  const lines: TicketLine[] = [];
  const text = (value: string | null | undefined, options: Omit<Extract<TicketLine, { kind: 'text' }>, 'kind' | 'text'> = {}) => {
    if (value && value.trim()) {
      lines.push({ kind: 'text', text: value.trim(), ...options });
    }
  };
  const row = (left: string, right: string, options: { bold?: boolean; size?: TicketSize } = {}) =>
    lines.push({ kind: 'row', left, right, ...options });
  const amountRow = (label: string, value: number) => {
    if (Math.abs(value) >= 0.005) {
      row(label, money(value), { size: 'sm' });
    }
  };

  // Encabezado: empresa
  text(invoice.companyCommercialNameSnapshot, { align: 'center', bold: true, size: 'lg' });
  if (invoice.companyLegalNameSnapshot !== invoice.companyCommercialNameSnapshot) {
    text(invoice.companyLegalNameSnapshot, { align: 'center', size: 'sm' });
  }
  text(`RTN: ${invoice.companyRtnSnapshot}`, { align: 'center', size: 'sm' });
  text(invoice.companyAddressSnapshot, { align: 'center', size: 'sm' });
  text(invoice.companyPhoneSnapshot ? `Tel: ${invoice.companyPhoneSnapshot}` : null, { align: 'center', size: 'sm' });
  text(invoice.companyEmailSnapshot, { align: 'center', size: 'sm' });
  lines.push({ kind: 'divider' });

  // Datos fiscales del documento
  text(invoice.settings?.invoiceTitle || 'FACTURA', { align: 'center', bold: true, size: 'md' });
  text(`No. ${invoice.invoiceNumber}`, { align: 'center', bold: true, size: 'md' });
  if (invoice.status === 'ANULADA') {
    text('*** ANULADA ***', { align: 'center', bold: true, size: 'lg' });
  }
  if (copy) {
    text('-- REIMPRESIÓN --', { align: 'center', size: 'sm' });
  }
  text(`CAI: ${invoice.caiSnapshot}`, { size: 'sm' });
  text(`Fecha: ${dateTime(invoice.issuedAt) || shortDate(invoice.printInvoiceDate)}`, { size: 'sm' });
  text(invoice.createdByName ? `Cajero: ${invoice.createdByName}` : null, { size: 'sm' });
  text(`Cliente: ${invoice.printCustomerName}`, { size: 'sm' });
  text(invoice.customerRtnSnapshot ? `RTN: ${invoice.customerRtnSnapshot}` : null, { size: 'sm' });
  lines.push({ kind: 'divider' });

  // Detalle
  for (const item of invoice.items) {
    text(item.description, { size: 'sm' });
    row(`${quantity(item.quantity)} x ${money(item.unitPrice)}`, money(item.lineSubtotal), { size: 'sm' });
    if (item.lineDiscount > 0) {
      row('  Descuento', `-${money(item.lineDiscount)}`, { size: 'sm' });
    }
  }
  lines.push({ kind: 'divider' });

  // Totales (mismos conceptos que la factura carta)
  amountRow('Subtotal', invoice.subtotal);
  amountRow('Descuento', -invoice.discountTotal);
  amountRow('Importe exonerado', invoice.exoneratedAmount);
  amountRow('Importe exento', invoice.exemptAmount);
  amountRow('Importe gravado 15%', invoice.taxableAmount15);
  amountRow('Importe gravado 18%', invoice.taxableAmount18);
  amountRow('ISV 15%', invoice.isv15);
  amountRow('ISV 18%', invoice.isv18);
  row('TOTAL', money(invoice.grandTotal), { bold: true, size: 'md' });

  if (payment) {
    row('Forma de pago', `${TENDER_LABEL[payment.method]}${payment.simulated ? ' (simulado)' : ''}`, { size: 'sm' });
    if (payment.method === 'EFECTIVO' && payment.received !== undefined) {
      row('Recibido', money(payment.received), { size: 'sm' });
      row('Cambio', money(payment.change ?? 0), { size: 'sm' });
    }
  }
  text(invoice.totalInWords ? `Son: ${invoice.totalInWords}` : null, { size: 'sm' });
  lines.push({ kind: 'divider' });

  // Pie fiscal
  text(`Rango autorizado: ${authorizedRange(invoice.invoiceNumber, invoice.rangeStartSnapshot, invoice.rangeEndSnapshot)}`, { size: 'sm' });
  text(`Fecha límite de emisión: ${shortDate(invoice.issueDeadlineSnapshot)}`, { size: 'sm' });
  text(invoice.notes ? `Nota: ${invoice.notes}` : null, { size: 'sm' });
  text(invoice.settings?.footerText, { align: 'center', size: 'sm' });
  text(`${invoice.settings?.legendOriginal ?? 'Original: Cliente'} / ${invoice.settings?.legendCopy ?? 'Copia: Obligado Tributario'}`, {
    align: 'center',
    size: 'sm',
  });
  lines.push({ kind: 'feed', lines: 4 });

  return lines;
}

export function buildTestTicket(serviceVersion: string | null): TicketLine[] {
  return [
    { kind: 'text', text: 'PRUEBA DE IMPRESIÓN', align: 'center', bold: true, size: 'lg' },
    { kind: 'text', text: 'Facturación POS', align: 'center', size: 'md' },
    { kind: 'divider' },
    { kind: 'text', text: 'Letra pequeña: áéíóú ñ ¿? ¡!', size: 'sm' },
    { kind: 'text', text: 'Letra normal: 1234567890', size: 'md' },
    { kind: 'text', text: 'Letra grande', size: 'lg' },
    { kind: 'text', text: '12345678901234567890123456789012', size: 'sm' },
    { kind: 'row', left: 'Izquierda', right: 'Derecha', size: 'sm' },
    { kind: 'row', left: 'TOTAL', right: money(1234.5), bold: true, size: 'md' },
    { kind: 'divider' },
    { kind: 'text', text: `Servicio Senraise: ${serviceVersion ?? 'desconocido'}`, size: 'sm' },
    { kind: 'text', text: new Date().toLocaleString(), size: 'sm' },
    { kind: 'feed', lines: 4 },
  ];
}

const ALIGN: Record<'left' | 'center' | 'right', Align> = { left: 0, center: 1, right: 2 };

/** Convierte el ticket a los comandos del servicio de impresión Senraise. */
export function toPrinterCommands(lines: TicketLine[]): PrintCommand[] {
  const commands: PrintCommand[] = [];
  for (const line of lines) {
    switch (line.kind) {
      case 'text':
        commands.push(
          { type: 'align', value: ALIGN[line.align ?? 'left'] },
          { type: 'size', value: PRINTER_TEXT_SIZE[line.size ?? 'md'] },
          { type: 'bold', value: Boolean(line.bold) },
          { type: 'text', text: `${line.text}\n` }
        );
        break;
      case 'row':
        commands.push(
          { type: 'size', value: PRINTER_TEXT_SIZE[line.size ?? 'md'] },
          { type: 'bold', value: Boolean(line.bold) },
          { type: 'table', texts: [line.left, line.right], weights: [3, 2], aligns: [0, 2] }
        );
        break;
      case 'divider':
        commands.push(
          { type: 'align', value: 1 },
          { type: 'size', value: PRINTER_TEXT_SIZE.sm },
          { type: 'bold', value: false },
          { type: 'text', text: `${'-'.repeat(TICKET_COLUMNS)}\n` }
        );
        break;
      case 'feed':
        commands.push({ type: 'feed', lines: line.lines });
        break;
    }
  }
  // Deja la impresora en su estado normal para la siguiente app.
  commands.push({ type: 'align', value: 0 }, { type: 'bold', value: false }, { type: 'size', value: PRINTER_TEXT_SIZE.md });
  return commands;
}
