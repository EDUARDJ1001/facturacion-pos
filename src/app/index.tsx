import { Redirect } from 'expo-router';

import { useSession } from '@/state/session';
import { Loading } from '@/ui/components';

export default function Index() {
  const { ready, config, user, company } = useSession();

  if (!ready) {
    return <Loading message="Cargando…" />;
  }
  if (!config.serverUrl) {
    return <Redirect href="/setup" />;
  }
  if (!user) {
    return <Redirect href="/login" />;
  }
  if (!company) {
    return <Redirect href="/empresa" />;
  }
  return <Redirect href="/venta" />;
}
