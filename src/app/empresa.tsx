import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';

import { errorMessage } from '@/lib/api';
import type { Company } from '@/lib/types';
import { useCart } from '@/state/cart';
import { useSession } from '@/state/session';
import { Banner, Button, Screen } from '@/ui/components';
import { colors, radius, spacing } from '@/ui/theme';

export default function Empresa() {
  const { companies, company, selectCompany, logout } = useSession();
  const cart = useCart();
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);

  const choose = async (selected: Company) => {
    setBusyId(selected.id);
    setError(null);
    try {
      // Los productos del carrito son de la empresa anterior.
      if (selected.id !== company?.id) {
        cart.clear();
      }
      await selectCompany(selected);
      router.replace('/venta');
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusyId(null);
    }
  };

  return (
    <Screen title="Elegir empresa">
      {companies.length === 0 ? <Banner tone="warning">Tu usuario no tiene empresas asignadas.</Banner> : null}
      {error ? <Banner tone="danger">{error}</Banner> : null}
      {companies.map((item) => (
        <Pressable
          key={item.id}
          onPress={() => choose(item)}
          disabled={busyId !== null}
          style={({ pressed }) => [styles.item, item.id === company?.id && styles.active, pressed && styles.pressed]}>
          <Text style={styles.name}>{item.commercialName}</Text>
          <Text style={styles.meta}>
            {item.legalName} · RTN {item.rtn}
          </Text>
          {busyId === item.id ? <Text style={styles.meta}>Seleccionando…</Text> : null}
        </Pressable>
      ))}
      <Button
        label="Cerrar sesión"
        variant="secondary"
        onPress={async () => {
          await logout();
          router.replace('/login');
        }}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  item: {
    backgroundColor: colors.surface,
    borderRadius: radius,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    gap: spacing.xs,
  },
  active: { borderColor: colors.primary, borderWidth: 2 },
  pressed: { opacity: 0.7 },
  name: { fontSize: 18, fontWeight: '700', color: colors.text },
  meta: { fontSize: 14, color: colors.muted },
});
