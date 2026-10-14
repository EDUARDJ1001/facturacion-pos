import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View } from 'react-native';

import { api, errorMessage } from '@/lib/api';
import { money, round2 } from '@/lib/format';
import { printerAvailable, printTicket } from '@/lib/printer';
import { buildInvoiceTicket, type PaymentInfo } from '@/lib/ticket';
import type { InvoiceDetail, TenderMethod } from '@/lib/types';
import { Banner, Button, Loading, Screen } from '@/ui/components';
import { TicketPreview } from '@/ui/TicketPreview';

export default function Ticket() {
  const params = useLocalSearchParams<{ id: string; method?: string; received?: string; auto?: string; simulated?: string }>();
  const [invoice, setInvoice] = useState<InvoiceDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [printError, setPrintError] = useState<string | null>(null);
  const [printing, setPrinting] = useState(false);
  const [printedCount, setPrintedCount] = useState(0);
  const [hasPrinter, setHasPrinter] = useState<boolean | null>(null);
  const autoPrinted = useRef(false);

  useEffect(() => {
    api<{ item: InvoiceDetail }>(`/api/invoices/${params.id}`)
      .then((result) => setInvoice(result.item))
      .catch((err) => setError(errorMessage(err)));
    printerAvailable().then(setHasPrinter);
  }, [params.id]);

  // Cobro y cambio solo cuando se llega desde la venta (en reimpresiones no se conocen).
  const payment = useMemo<PaymentInfo | undefined>(() => {
    if (!params.method || !invoice) {
      return undefined;
    }
    const received = params.received ? Number(params.received) : undefined;
    return {
      method: params.method as TenderMethod,
      received,
      change: received !== undefined ? round2(received - Number(invoice.grandTotal)) : undefined,
      simulated: params.simulated === '1',
    };
  }, [params.method, params.received, params.simulated, invoice]);

  const lines = useMemo(
    () => (invoice ? buildInvoiceTicket(invoice, payment, printedCount > 0) : []),
    [invoice, payment, printedCount]
  );

  const print = useCallback(async () => {
    if (!invoice) {
      return;
    }
    setPrinting(true);
    setPrintError(null);
    try {
      await printTicket(buildInvoiceTicket(invoice, payment, printedCount > 0));
      setPrintedCount((count) => count + 1);
    } catch (err) {
      setPrintError(errorMessage(err));
    } finally {
      setPrinting(false);
    }
  }, [invoice, payment, printedCount]);

  // Recién emitida: imprime sola una vez, sin diálogos.
  useEffect(() => {
    if (params.auto === '1' && invoice && hasPrinter && !autoPrinted.current) {
      autoPrinted.current = true;
      void print();
    }
  }, [params.auto, invoice, hasPrinter, print]);

  if (error) {
    return (
      <Screen title="Factura">
        <Banner tone="danger">{error}</Banner>
        <Button label="Volver a la venta" onPress={() => router.replace('/venta')} />
      </Screen>
    );
  }
  if (!invoice) {
    return <Loading message="Cargando factura…" />;
  }

  return (
    <Screen
      title={`Factura ${invoice.invoiceNumber}`}
      footer={
        <View style={{ gap: 8 }}>
          <Button
            label={printedCount > 0 ? 'Reimprimir' : 'Imprimir ticket'}
            variant="secondary"
            onPress={print}
            loading={printing}
            disabled={hasPrinter === false}
          />
          <Button label="Nueva venta" variant="success" onPress={() => router.replace('/venta')} />
        </View>
      }>
      <Banner tone="success">
        Factura emitida · Total {money(Number(invoice.grandTotal))}
        {payment?.change !== undefined && payment.change > 0 ? ` · Cambio ${money(payment.change)}` : ''}
      </Banner>
      {hasPrinter === false ? (
        <Banner tone="info">Este equipo no tiene impresora Senraise: se muestra solo la vista previa.</Banner>
      ) : null}
      {printError ? <Banner tone="danger">{printError}</Banner> : null}
      <TicketPreview lines={lines} />
    </Screen>
  );
}
