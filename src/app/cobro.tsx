import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { api, errorMessage } from '@/lib/api';
import { money, quantity, round2 } from '@/lib/format';
import { nfcStatus } from '@/lib/nfc';
import type { CreateInvoicePayload, TenderMethod } from '@/lib/types';
import { sellsWholeUnits, useCart, type CartLine } from '@/state/cart';
import { CardPaymentModal } from '@/ui/CardPaymentModal';
import { Banner, Button, Card, Field, HeaderLink, Row, Screen } from '@/ui/components';
import { colors, radius, spacing } from '@/ui/theme';

const METHODS: { value: TenderMethod; label: string }[] = [
  { value: 'EFECTIVO', label: 'Efectivo' },
  { value: 'TARJETA', label: 'Tarjeta' },
  { value: 'TRANSFERENCIA', label: 'Transferencia' },
];

const CASH_SHORTCUTS = [50, 100, 200, 500, 1000];

function parseAmount(value: string) {
  const number = Number(value.replace(/,/g, '.'));
  return Number.isFinite(number) ? number : NaN;
}

function QuantityControl({ line }: { line: CartLine }) {
  const cart = useCart();
  const whole = sellsWholeUnits(line.product);
  const [text, setText] = useState(quantity(line.quantity));
  const [editing, setEditing] = useState(false);

  const commit = () => {
    setEditing(false);
    const value = parseAmount(text);
    if (!Number.isFinite(value) || value <= 0) {
      setText(quantity(line.quantity));
      return;
    }
    cart.setQuantity(line.product.id, whole ? Math.round(value) : round2(value));
  };

  return (
    <View style={styles.qty}>
      <Pressable style={styles.qtyButton} onPress={() => cart.setQuantity(line.product.id, line.quantity - 1)} hitSlop={6}>
        <Text style={styles.qtyButtonText}>−</Text>
      </Pressable>
      <TextInput
        value={editing ? text : quantity(line.quantity)}
        onFocus={() => {
          setEditing(true);
          setText(quantity(line.quantity));
        }}
        onChangeText={setText}
        onBlur={commit}
        onSubmitEditing={commit}
        keyboardType={whole ? 'number-pad' : 'decimal-pad'}
        style={styles.qtyInput}
        selectTextOnFocus
      />
      <Pressable style={styles.qtyButton} onPress={() => cart.add(line.product, 1)} hitSlop={6}>
        <Text style={styles.qtyButtonText}>+</Text>
      </Pressable>
    </View>
  );
}

export default function Cobro() {
  const cart = useCart();
  const { totals } = cart;
  const [method, setMethod] = useState<TenderMethod>('EFECTIVO');
  const [received, setReceived] = useState('');
  const [finalConsumer, setFinalConsumer] = useState(true);
  const [customerName, setCustomerName] = useState('');
  const [customerRtn, setCustomerRtn] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [nfc, setNfc] = useState<'none' | 'off' | 'on'>('none');
  const [waitingCard, setWaitingCard] = useState(false);

  useEffect(() => {
    void nfcStatus().then(setNfc);
  }, [method]);

  // Con tarjeta y NFC disponible, el cobro es simulado: se espera una tarjeta antes de emitir.
  const simulateCard = method === 'TARJETA' && nfc === 'on';

  const receivedAmount = received ? parseAmount(received) : NaN;
  const change = Number.isFinite(receivedAmount) ? round2(receivedAmount - totals.total) : null;
  const cashShort = method === 'EFECTIVO' && received !== '' && (change === null || change < 0);

  const validate = () => {
    if (cart.lines.length === 0) {
      return false;
    }
    if (!finalConsumer && customerName.trim().length < 2) {
      setError('Escribe el nombre del cliente (o marca Consumidor final).');
      return false;
    }
    if (cashShort) {
      setError('El efectivo recibido no alcanza para el total.');
      return false;
    }
    return true;
  };

  const charge = () => {
    if (!validate()) {
      return;
    }
    if (simulateCard) {
      setError(null);
      setWaitingCard(true);
    } else {
      void emit();
    }
  };

  const emit = async (cardRef?: string) => {
    setBusy(true);
    setError(null);
    try {
      const payload: CreateInvoicePayload = {
        customer: finalConsumer
          ? { name: 'Consumidor Final' }
          : { name: customerName.trim(), rtn: customerRtn.trim() || undefined },
        saleType: 'CONTADO',
        tenderMethod: method,
        notes: cardRef ? `Pago con tarjeta SIMULADO (prueba NFC, ref. ${cardRef})` : undefined,
        items: cart.lines.map((line) => ({ productId: line.product.id, quantity: line.quantity })),
      };
      const result = await api<{ item: { id: number } }>('/api/invoices', { method: 'POST', body: payload });
      cart.clear();
      router.replace({
        pathname: '/ticket/[id]',
        params: {
          id: String(result.item.id),
          method,
          received: method === 'EFECTIVO' && Number.isFinite(receivedAmount) ? String(receivedAmount) : '',
          auto: '1',
          simulated: cardRef ? '1' : '',
        },
      });
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen
      title="Cobro"
      right={<HeaderLink label="Seguir vendiendo" onPress={() => router.back()} />}
      footer={
        <Button
          label={
            busy ? 'Emitiendo…' : simulateCard ? `Cobrar con tarjeta · ${money(totals.total)}` : `Emitir factura · ${money(totals.total)}`
          }
          variant="success"
          onPress={charge}
          loading={busy}
          disabled={cart.lines.length === 0 || cashShort}
        />
      }>
      {waitingCard ? (
      <CardPaymentModal
        visible
        amount={totals.total}
        onCancel={() => setWaitingCard(false)}
        onApproved={(tag) => {
          setWaitingCard(false);
          void emit(tag.id.slice(-4) || 'NFC');
        }}
      />
      ) : null}
      {cart.lines.length === 0 ? <Banner tone="info">El carrito está vacío.</Banner> : null}

      <Card>
        {cart.lines.map((line) => (
          <View key={line.product.id} style={styles.line}>
            <View style={styles.lineInfo}>
              <Text style={styles.lineName} numberOfLines={2}>
                {line.product.name}
              </Text>
              <Text style={styles.lineMeta}>
                {money(Number(line.product.salePrice))} c/u · {line.product.unitMeasure}
              </Text>
            </View>
            <QuantityControl line={line} />
            <Pressable onPress={() => cart.remove(line.product.id)} hitSlop={8}>
              <Text style={styles.remove}>✕</Text>
            </Pressable>
          </View>
        ))}
        <View style={styles.separator} />
        <Row label="Subtotal" value={money(totals.subtotal)} />
        <Row label="ISV" value={money(totals.tax)} />
        <Row label="Total" value={money(totals.total)} strong />
        <Text style={styles.hint}>El total final lo calcula el servidor al emitir.</Text>
      </Card>

      <Card>
        <Text style={styles.section}>Cliente</Text>
        <View style={styles.chips}>
          <Chip label="Consumidor final" active={finalConsumer} onPress={() => setFinalConsumer(true)} />
          <Chip label="Con nombre / RTN" active={!finalConsumer} onPress={() => setFinalConsumer(false)} />
        </View>
        {!finalConsumer ? (
          <>
            <Field label="Nombre" value={customerName} onChangeText={setCustomerName} autoCapitalize="words" />
            <Field
              label="RTN (opcional)"
              value={customerRtn}
              onChangeText={setCustomerRtn}
              keyboardType="number-pad"
              maxLength={14}
            />
          </>
        ) : null}
      </Card>

      <Card>
        <Text style={styles.section}>Forma de pago</Text>
        <View style={styles.chips}>
          {METHODS.map((item) => (
            <Chip key={item.value} label={item.label} active={method === item.value} onPress={() => setMethod(item.value)} />
          ))}
        </View>
        {method === 'TARJETA' && nfc === 'on' ? (
          <Banner tone="warning">Modo prueba: al cobrar se activa el NFC y cualquier tarjeta o teléfono con billetera se aprueba sin cargo real.</Banner>
        ) : null}
        {method === 'TARJETA' && nfc === 'off' ? (
          <Banner tone="info">El NFC de la terminal está apagado: la factura se emite sin simular el pago.</Banner>
        ) : null}
        {method === 'EFECTIVO' ? (
          <>
            <Field
              label="Efectivo recibido"
              value={received}
              onChangeText={setReceived}
              keyboardType="decimal-pad"
              placeholder={money(totals.total)}
            />
            <View style={styles.chips}>
              <Chip label="Exacto" active={false} onPress={() => setReceived(totals.total.toFixed(2))} />
              {CASH_SHORTCUTS.filter((value) => value >= totals.total).slice(0, 3).map((value) => (
                <Chip key={value} label={`L${value}`} active={false} onPress={() => setReceived(String(value))} />
              ))}
            </View>
            {change !== null ? (
              <Row label={change < 0 ? 'Falta' : 'Cambio'} value={money(Math.abs(change))} strong />
            ) : null}
          </>
        ) : null}
      </Card>

      {error ? <Banner tone="danger">{error}</Banner> : null}
    </Screen>
  );
}

function Chip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={[styles.chip, active && styles.chipActive]}>
      <Text style={[styles.chipText, active && styles.chipTextActive]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  line: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.xs },
  lineInfo: { flex: 1 },
  lineName: { fontSize: 15, fontWeight: '600', color: colors.text },
  lineMeta: { fontSize: 12, color: colors.muted },
  qty: { flexDirection: 'row', alignItems: 'center' },
  qtyButton: {
    width: 40,
    height: 40,
    borderRadius: radius,
    backgroundColor: '#EAF1FB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  qtyButtonText: { fontSize: 22, fontWeight: '700', color: colors.primary },
  qtyInput: { width: 52, textAlign: 'center', fontSize: 16, fontWeight: '700', color: colors.text, paddingVertical: 4 },
  remove: { fontSize: 18, color: colors.danger, paddingHorizontal: spacing.xs },
  separator: { height: 1, backgroundColor: colors.border, marginVertical: spacing.xs },
  hint: { fontSize: 12, color: colors.muted },
  section: { fontSize: 16, fontWeight: '700', color: colors.text },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  chip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    minHeight: 40,
    justifyContent: 'center',
  },
  chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { fontSize: 15, color: colors.text, fontWeight: '600' },
  chipTextActive: { color: colors.primaryText },
});
