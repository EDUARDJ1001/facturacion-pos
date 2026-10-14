/** Alineación del servicio Senraise: 0 izquierda, 1 centro, 2 derecha. */
export type Align = 0 | 1 | 2;

/** Comandos que entiende el módulo nativo (se ejecutan en orden). */
export type PrintCommand =
  | { type: 'text'; text: string }
  | { type: 'align'; value: Align }
  | { type: 'size'; value: number }
  | { type: 'bold'; value: boolean }
  | { type: 'doubleWidth'; value: boolean }
  | { type: 'doubleHeight'; value: boolean }
  | { type: 'lineHeight'; value: number }
  | { type: 'dark'; value: number }
  | { type: 'feed'; lines: number }
  | { type: 'table'; texts: string[]; weights: number[]; aligns: Align[] }
  | { type: 'qr'; text: string; size: number; level: number }
  | { type: 'barcode'; text: string; symbology: number; height: number; width: number }
  | { type: 'image'; base64: string }
  | { type: 'raw'; base64: string }
  | { type: 'beginWork' }
  | { type: 'endWork' };
