import { router } from 'expo-router';
import { useState } from 'react';
import { Text } from 'react-native';

import { errorMessage } from '@/lib/api';
import { useSession } from '@/state/session';
import { Banner, Button, Card, Field, Screen } from '@/ui/components';
import { colors } from '@/ui/theme';

export default function Login() {
  const { config, login } = useSession();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!username.trim() || !password) {
      setError('Escribe usuario y contraseña.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await login(username.trim(), password);
      setPassword('');
      router.replace('/');
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen title="Iniciar sesión">
      <Card>
        <Field
          label="Usuario"
          value={username}
          onChangeText={setUsername}
          autoCapitalize="none"
          autoCorrect={false}
          returnKeyType="next"
        />
        <Field
          label="Contraseña"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          onSubmitEditing={submit}
          returnKeyType="go"
        />
        {error ? <Banner tone="danger">{error}</Banner> : null}
        <Button label="Entrar" onPress={submit} loading={busy} />
      </Card>
      <Text style={{ color: colors.muted, textAlign: 'center' }}>Servidor: {config.serverUrl}</Text>
      <Button label="Cambiar servidor" variant="secondary" onPress={() => router.push('/setup')} />
    </Screen>
  );
}
