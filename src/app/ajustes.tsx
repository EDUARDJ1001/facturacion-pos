import Constants from 'expo-constants';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';

import { errorMessage } from '@/lib/api';
import { printerAvailable, printerServiceVersion, printTicket } from '@/lib/printer';
import { buildTestTicket } from '@/lib/ticket';
import { useCart } from '@/state/cart';
import { useSession } from '@/state/session';
import { Banner, Button, Card, HeaderLink, Row, Screen } from '@/ui/components';

export default function Ajustes() {
  const { config, user, company, companies, logout } = useSession();
  const cart = useCart();
  const [printer, setPrinter] = useState<{ available: boolean; version: string | null } | null>(null);
  const [printing, setPrinting] = useState(false);
  const [message, setMessage] = useState<{ tone: 'success' | 'danger'; text: string } | null>(null);

  useEffect(() => {
    (async () => {
      const available = await printerAvailable();
      setPrinter({ available, version: available ? await printerServiceVersion() : null });
    })();
  }, []);

  const testPrint = async () => {
    setPrinting(true);
    setMessage(null);
    try {
      await printTicket(buildTestTicket(printer?.version ?? null));
      setMessage({ tone: 'success', text: 'Prueba enviada a la impresora.' });
    } catch (err) {
      setMessage({ tone: 'danger', text: errorMessage(err) });
    } finally {
      setPrinting(false);
    }
  };

  const signOut = async () => {
    cart.clear();
    await logout();
    router.replace('/login');
  };

  return (
    <Screen title="Ajustes" right={<HeaderLink label="Volver" onPress={() => router.back()} />}>
      <Card>
        <Row label="Usuario" value={user?.fullName ?? '-'} />
        <Row label="Rol" value={user?.role ?? '-'} />
        <Row label="Empresa" value={company?.commercialName ?? '-'} />
        <Row label="Servidor" value={config.serverUrl ?? '-'} />
        <Row label="Versión de la app" value={Constants.expoConfig?.version ?? '-'} />
      </Card>

      <Card>
        <Row
          label="Impresora"
          value={printer === null ? 'Revisando…' : printer.available ? 'Senraise integrada' : 'No disponible'}
        />
        {printer?.version ? <Row label="Servicio" value={printer.version} /> : null}
        <Button label="Imprimir prueba" variant="secondary" onPress={testPrint} loading={printing} disabled={!printer?.available} />
        {message ? <Banner tone={message.tone}>{message.text}</Banner> : null}
      </Card>

      {companies.length > 1 ? (
        <Button label="Cambiar de empresa" variant="secondary" onPress={() => router.push('/empresa')} />
      ) : null}
      <Button label="Cambiar servidor" variant="secondary" onPress={() => router.push('/setup')} />
      <Button label="Cerrar sesión" variant="danger" onPress={signOut} />
    </Screen>
  );
}
