import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';

import { round2 } from '@/lib/format';
import type { Product } from '@/lib/types';

/** Máximo de líneas por factura (MAX_SALE_LINES del backend). */
export const MAX_LINES = 60;

export interface CartLine {
  product: Product;
  quantity: number;
}

interface CartTotals {
  subtotal: number;
  tax: number;
  total: number;
  units: number;
}

interface CartValue {
  lines: CartLine[];
  totals: CartTotals;
  add: (product: Product, quantity?: number) => void;
  setQuantity: (productId: number, quantity: number) => void;
  remove: (productId: number) => void;
  clear: () => void;
}

const CartContext = createContext<CartValue | null>(null);

// Misma lista que COUNTABLE_UNITS del backend (inventory-rules.ts).
const COUNTABLE_UNITS = new Set([
  'UND', 'UNI', 'UNIDAD', 'UNIDADES', 'U', 'PCS', 'PC', 'PZA', 'PZ', 'PIEZA', 'PIEZAS', 'CAJA', 'CAJAS', 'CJ',
  'PAQ', 'PAQUETE', 'PAR', 'PARES', 'DOC', 'DOCENA', 'BOLSA', 'BOTELLA', 'LATA', 'ROLLO', 'JUEGO', 'KIT', 'SET',
]);

/** Unidades que solo se venden enteras (el backend rechaza decimales en ellas). */
export function sellsWholeUnits(product: Product) {
  return COUNTABLE_UNITS.has((product.unitMeasure ?? '').trim().toUpperCase());
}

/**
 * Totales de vista previa con la misma regla del backend: precio sin ISV, impuesto por línea
 * redondeado a 2 decimales. El total definitivo lo calcula el servidor al emitir.
 */
function computeTotals(lines: CartLine[]): CartTotals {
  let subtotal = 0;
  let tax = 0;
  let units = 0;
  for (const line of lines) {
    const lineSubtotal = round2(line.quantity * Number(line.product.salePrice));
    const rate = line.product.taxable ? Number(line.product.taxRate) : 0;
    subtotal += lineSubtotal;
    tax += round2((lineSubtotal * rate) / 100);
    units += line.quantity;
  }
  return { subtotal: round2(subtotal), tax: round2(tax), total: round2(subtotal + tax), units: round2(units) };
}

export function CartProvider({ children }: { children: ReactNode }) {
  const [lines, setLines] = useState<CartLine[]>([]);

  const value = useMemo<CartValue>(
    () => ({
      lines,
      totals: computeTotals(lines),
      add: (product, quantity = 1) =>
        setLines((current) => {
          const existing = current.find((line) => line.product.id === product.id);
          if (existing) {
            return current.map((line) =>
              line.product.id === product.id ? { ...line, quantity: round2(line.quantity + quantity) } : line
            );
          }
          if (current.length >= MAX_LINES) {
            return current;
          }
          return [...current, { product, quantity }];
        }),
      setQuantity: (productId, quantity) =>
        setLines((current) =>
          quantity <= 0
            ? current.filter((line) => line.product.id !== productId)
            : current.map((line) => (line.product.id === productId ? { ...line, quantity: round2(quantity) } : line))
        ),
      remove: (productId) => setLines((current) => current.filter((line) => line.product.id !== productId)),
      clear: () => setLines([]),
    }),
    [lines]
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const value = useContext(CartContext);
  if (!value) {
    throw new Error('useCart fuera de CartProvider');
  }
  return value;
}
