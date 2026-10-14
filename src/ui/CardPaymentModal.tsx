import { useEffect, useState } from 'react';
import { ActivityIndicator, Modal, StyleSheet, Text, Vibration, View } from 'react-native';

import NfcReader, { type NfcTagEvent } from '../../modules/nfc-reader';
import { money } from '@/lib/format';
import { Button } from './components';
import { colors, radius, spacing } from './theme';

const WAIT_SECONDS = 60;

type Phase = 'waiting' | 'approved' | 'error';

/**
 * Cobro con tarjeta SIMULADO para pruebas: activa el lector NFC y, al detectar una tarjeta
 * sin contacto o un teléfono con billetera, lo da por aprobado. No lee datos de la tarjeta.
 * Se monta solo mientras se espera la tarjeta (cada cobro empieza con estado limpio).
 */
export function CardPaymentModal({
  visible,
  amount,
  onApproved,
  onCancel,
}: {
  visible: boolean;
  amount: number;
  onApproved: (tag: NfcTagEvent) => void;
  onCancel: () => void;
}) {
  const [phase, setPhase] = useState<Phase>('waiting');
  const [message, setMessage] = useState<string | null>(null);
  const [secondsLeft, setSecondsLeft] = useState(WAIT_SECONDS);

  useEffect(() => {
    if (!visible || !NfcReader) {
      return;
    }
    let done = false;
    let approveTimer: ReturnType<typeof setTimeout> | undefined;

    const subscription = NfcReader.addListener('onTag', (tag) => {
      if (done) {
        return;
      }
      done = true;
      void NfcReader?.stop();
      Vibration.vibrate(150);
      setPhase('approved');
      // Deja ver "Aprobado" un momento antes de emitir.
      approveTimer = setTimeout(() => onApproved(tag), 1200);
    });

    NfcReader.start().catch((err: Error) => {
      done = true;
      setPhase('error');
      setMessage(err.message);
    });

    let remaining = WAIT_SECONDS;
    const countdown = setInterval(() => {
      remaining -= 1;
      setSecondsLeft(Math.max(0, remaining));
      if (remaining <= 0 && !done) {
        done = true;
        void NfcReader?.stop();
        setPhase('error');
        setMessage('No se detectó ninguna tarjeta. Intenta de nuevo.');
      }
    }, 1000);

    return () => {
      done = true;
      subscription.remove();
      clearInterval(countdown);
      if (approveTimer) {
        clearTimeout(approveTimer);
      }
      void NfcReader?.stop();
    };
    // onApproved cambia en cada render del padre; la lectura depende solo de abrir/cerrar.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          <Text style={styles.simulated}>PAGO SIMULADO · PRUEBAS</Text>
          <Text style={styles.amount}>{money(amount)}</Text>

          {phase === 'waiting' ? (
            <>
              <View style={styles.contactless}>
                <Text style={styles.contactlessIcon}>)))</Text>
              </View>
              <Text style={styles.title}>Acerque la tarjeta o el teléfono</Text>
              <Text style={styles.hint}>Al reverso de la terminal, cerca del lector NFC. {secondsLeft} s</Text>
              <ActivityIndicator color={colors.primary} />
              <Button label="Cancelar" variant="secondary" onPress={onCancel} />
            </>
          ) : null}

          {phase === 'approved' ? (
            <>
              <View style={[styles.contactless, styles.approvedCircle]}>
                <Text style={[styles.contactlessIcon, styles.approvedIcon]}>✓</Text>
              </View>
              <Text style={[styles.title, { color: colors.success }]}>Aprobado</Text>
              <Text style={styles.hint}>Emitiendo factura…</Text>
            </>
          ) : null}

          {phase === 'error' ? (
            <>
              <Text style={[styles.title, { color: colors.danger }]}>{message}</Text>
              <Button label="Cerrar" variant="secondary" onPress={onCancel} />
            </>
          ) : null}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
    justifyContent: 'center',
    padding: spacing.lg,
  },
  sheet: {
    backgroundColor: colors.surface,
    borderRadius: radius * 1.5,
    padding: spacing.xl,
    gap: spacing.md,
    alignItems: 'stretch',
  },
  simulated: { textAlign: 'center', fontSize: 12, fontWeight: '800', color: colors.warning, letterSpacing: 1 },
  amount: { textAlign: 'center', fontSize: 34, fontWeight: '800', color: colors.text },
  contactless: {
    alignSelf: 'center',
    width: 110,
    height: 110,
    borderRadius: 55,
    backgroundColor: '#EAF1FB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  contactlessIcon: { fontSize: 40, fontWeight: '800', color: colors.primary },
  approvedCircle: { backgroundColor: colors.successSoft },
  approvedIcon: { color: colors.success, fontSize: 56 },
  title: { textAlign: 'center', fontSize: 19, fontWeight: '700', color: colors.text },
  hint: { textAlign: 'center', fontSize: 14, color: colors.muted },
});
