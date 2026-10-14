import { router } from 'expo-router';
import { useState } from 'react';
import { Text } from 'react-native';

import { checkServer, errorMessage, normalizeServerUrl } from '@/lib/api';
import { printerServiceVersion, printTicket } from '@/lib/printer';
import { buildTestTicket } from '@/lib/ticket';
import { useSession } from '@/state/session';
import { Banner, Button, Card, Field, Screen } from '@/ui/components';
import { colors } from '@/ui/theme';

export default function Setup() {
  const { config, setServerUrl } = useSession();
  const [url, setUrl] = useState(config.serverUrl ?? '');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [printing, setPrinting] = useState(false);
  const [printResult, setPrintResult] = useState<{ ok: boolean; text: string } | null>(null);

  // Prueba de la impresora sin servidor ni sesión (útil al instalar la terminal).
  const testPrinter = async () => {
    setPrinting(true);
    setPrintResult(null);
    try {
      await printTicket(buildTestTicket(await printerServiceVersion()));
      setPrintResult({ ok: true, text: 'Prueba enviada a la impresora.' });
    } catch (err) {
      setPrintResult({ ok: false, text: errorMessage(err) });
    } finally {
      setPrinting(false);
    }
  };

  const save = async () => {
    const normalized = normalizeServerUrl(url);
    if (!normalized) {
      setError('Escribe la dirección del servidor.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const status = await checkServer(normalized);
      if (!status.ok) {
        setError(
          status.database
            ? 'El servidor respondió con un error.'
            : 'El servidor responde pero no tiene conexión con la base de datos.'
        );
        return;
      }
      await setServerUrl(normalized);
      router.replace('/login');
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen title="Conectar con el servidor">
      <Card>
        <Text style={{ color: colors.muted, fontSize: 14 }}>
          Dirección del backend de facturación. En la red del local usa la IP de la PC servidor con su puerto (por
          ejemplo 192.168.1.50:4000). En la nube, la dirección https completa.
        </Text>
        <Field
          label="Servidor"
          value={url}
          onChangeText={setUrl}
          placeholder="192.168.1.50:4000"
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="url"
          onSubmitEditing={save}
          returnKeyType="done"
        />
        {error ? <Banner tone="danger">{error}</Banner> : null}
        <Button label="Probar y guardar" onPress={save} loading={busy} />
      </Card>
      <Button label="Probar impresora" variant="secondary" onPress={testPrinter} loading={printing} />
      {printResult ? <Banner tone={printResult.ok ? 'success' : 'danger'}>{printResult.text}</Banner> : null}
    </Screen>
  );
}
