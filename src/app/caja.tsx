import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Text } from 'react-native';

import { api, errorMessage } from '@/lib/api';
import { dateTime, money } from '@/lib/format';
import { saveTerminalToken } from '@/lib/storage';
import type { CashOverview, CashRegisterOverview } from '@/lib/types';
import { Banner, Button, Card, Field, HeaderLink, Loading, Row, Screen } from '@/ui/components';
import { colors } from '@/ui/theme';

function parseAmount(value: string) {
  const number = Number(value.replace(/,/g, '.'));
  return Number.isFinite(number) && number >= 0 ? Math.round(number * 100) / 100 : NaN;
}

export default function Caja() {
  const [overview, setOverview] = useState<CashOverview | null>(null);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    try {
      setOverview(await api<CashOverview>('/api/caja/overview'));
      setError(null);
    } catch (err) {
      setError(errorMessage(err));
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void reload();
    }, [reload])
  );

  const back = <HeaderLink label="Volver" onPress={() => router.back()} />;

  if (!overview) {
    return error ? (
      <Screen title="Caja" right={back}>
        <Banner tone="danger">{error}</Banner>
        <Button label="Reintentar" onPress={reload} />
      </Screen>
    ) : (
      <Loading message="Cargando caja…" />
    );
  }

  const registers = overview.registers.filter((register) => register.canOperate);

  return (
    <Screen title="Caja" right={back}>
      {error ? <Banner tone="danger">{error}</Banner> : null}
      <TerminalCard overview={overview} onChanged={reload} />
      {overview.terminalStatus === 'ok' || overview.canManage
        ? registers.map((register) => <RegisterCard key={register.id} register={register} onChanged={reload} />)
        : null}
      {overview.terminalStatus === 'ok' && registers.length === 0 ? (
        <Banner tone="info">No hay cajas que este equipo pueda operar.</Banner>
      ) : null}
    </Screen>
  );
}

/** Vinculación del equipo: el administrador genera un código en el sistema (Caja > Equipos). */
function TerminalCard({ overview, onChanged }: { overview: CashOverview; onChanged: () => void }) {
  const [code, setCode] = useState('');
  const [name, setName] = useState('Terminal POS');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pair = async () => {
    setBusy(true);
    setError(null);
    try {
      const result = await api<{ token: string }>('/api/caja/terminals/pair', {
        method: 'POST',
        body: { code: code.trim().toUpperCase(), name: name.trim() || undefined },
      });
      await saveTerminalToken(result.token);
      setCode('');
      onChanged();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const unpair = async () => {
    await saveTerminalToken(null);
    onChanged();
  };

  if (overview.terminalStatus === 'ok' && overview.terminal) {
    return (
      <Card>
        <Row label="Equipo" value={overview.terminal.name} />
        <Row label="Caja" value={overview.terminal.registerName} />
        <Button label="Desvincular este equipo" variant="secondary" onPress={unpair} />
      </Card>
    );
  }

  return (
    <Card>
      <Text style={{ fontSize: 16, fontWeight: '700', color: colors.text }}>Vincular esta terminal a una caja</Text>
      {overview.terminalStatus === 'invalid' ? (
        <Banner tone="warning">El vínculo de esta terminal fue revocado. Vincúlala de nuevo.</Banner>
      ) : null}
      {overview.terminalStatus === 'network' ? (
        <Banner tone="warning">
          {overview.saleBlockedReason ?? 'La terminal está fuera de la red autorizada para esta caja.'}
        </Banner>
      ) : null}
      <Text style={{ color: colors.muted }}>
        En el sistema de escritorio, un administrador genera el código de vinculación en Caja (equipos de la caja).
        Escríbelo aquí.
      </Text>
      <Field label="Código de vinculación" value={code} onChangeText={setCode} autoCapitalize="characters" autoCorrect={false} maxLength={12} />
      <Field label="Nombre de este equipo" value={name} onChangeText={setName} maxLength={80} />
      {error ? <Banner tone="danger">{error}</Banner> : null}
      <Button label="Vincular" onPress={pair} loading={busy} disabled={code.trim().length < 8} />
    </Card>
  );
}

function RegisterCard({ register, onChanged }: { register: CashRegisterOverview; onChanged: () => void }) {
  const [amount, setAmount] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const session = register.session;

  const submit = async () => {
    const value = parseAmount(amount || '0');
    if (Number.isNaN(value)) {
      setError('Monto inválido.');
      return;
    }
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      if (session) {
        const result = await api<{ session?: { expectedAmount?: number; countedAmount?: number } }>('/api/caja/close', {
          method: 'POST',
          body: { cashSessionId: session.id, countedAmount: value },
        });
        const expected = result.session?.expectedAmount;
        setMessage(
          expected !== undefined
            ? `Caja cerrada. Esperado ${money(Number(expected))}, contado ${money(value)}.`
            : 'Caja cerrada.'
        );
      } else {
        await api('/api/caja/open', { method: 'POST', body: { cashRegisterId: register.id, openingAmount: value } });
        setMessage('Caja abierta. Ya puedes vender.');
      }
      setAmount('');
      onChanged();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card>
      <Text style={{ fontSize: 17, fontWeight: '700', color: colors.text }}>{register.name}</Text>
      {session ? (
        <>
          <Row label="Abierta" value={dateTime(session.openedAt)} />
          {session.openedByName ? <Row label="Por" value={session.openedByName} /> : null}
          <Row label="Fondo inicial" value={money(Number(session.openingAmount))} />
          {register.summary ? (
            <>
              <Row label="Entradas de efectivo" value={money(register.summary.cashIn)} />
              <Row label="Salidas de efectivo" value={money(register.summary.cashOut)} />
              <Row label="Efectivo esperado" value={money(register.summary.expectedCash)} strong />
            </>
          ) : null}
          {register.canClose ? (
            <>
              <Field label="Efectivo contado" value={amount} onChangeText={setAmount} keyboardType="decimal-pad" />
              <Button label="Cerrar caja" variant="danger" onPress={submit} loading={busy} disabled={!amount} />
            </>
          ) : null}
        </>
      ) : (
        <>
          <Text style={{ color: colors.muted }}>Cerrada.</Text>
          <Field label="Fondo inicial" value={amount} onChangeText={setAmount} keyboardType="decimal-pad" placeholder="0.00" />
          <Button label="Abrir caja" variant="success" onPress={submit} loading={busy} />
        </>
      )}
      {message ? <Banner tone="success">{message}</Banner> : null}
      {error ? <Banner tone="danger">{error}</Banner> : null}
    </Card>
  );
}
