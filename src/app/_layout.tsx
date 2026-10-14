import { Stack, router, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { CartProvider } from '@/state/cart';
import { SessionProvider, useSession } from '@/state/session';
import { colors } from '@/ui/theme';

const PUBLIC_SCREENS = new Set<string>(['setup', 'login']);

/** Si la sesión se pierde (expiró o se cerró), vuelve al inicio de sesión. */
function SessionGuard() {
  const { ready, config, user } = useSession();
  const segments = useSegments();
  // Sin segmentos = pantalla de inicio (index), que decide sola a dónde ir.
  const current: string | undefined = segments[0];

  useEffect(() => {
    if (!ready || !current || PUBLIC_SCREENS.has(current)) {
      return;
    }
    if (!config.serverUrl) {
      router.replace('/setup');
    } else if (!user) {
      router.replace('/login');
    }
  }, [ready, config.serverUrl, user, current]);

  return null;
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <SessionProvider>
        <CartProvider>
          <StatusBar style="light" />
          <SessionGuard />
          <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background } }} />
        </CartProvider>
      </SessionProvider>
    </SafeAreaProvider>
  );
}
