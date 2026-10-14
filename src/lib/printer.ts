import SenraisePrinter from '../../modules/senraise-printer';
import { toPrinterCommands, type TicketLine } from './ticket';

/** true en una terminal Senraise con su servicio de impresión. */
export async function printerAvailable() {
  if (!SenraisePrinter) {
    return false;
  }
  try {
    return await SenraisePrinter.isAvailable();
  } catch {
    return false;
  }
}

export async function printerServiceVersion() {
  try {
    return (await SenraisePrinter?.getServiceVersion()) ?? null;
  } catch {
    return null;
  }
}

export async function printTicket(lines: TicketLine[]) {
  if (!SenraisePrinter || !(await printerAvailable())) {
    throw new Error('Este equipo no tiene la impresora Senraise. Usa la vista previa.');
  }
  await SenraisePrinter.print(toPrinterCommands(lines));
}
