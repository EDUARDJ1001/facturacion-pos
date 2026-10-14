import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';

// Configuración del equipo (no secreta) en AsyncStorage; tokens en el almacén seguro.
const CONFIG_KEY = 'pos.config';
const ACCESS_KEY = 'pos.accessToken';
const REFRESH_KEY = 'pos.refreshToken';
const TERMINAL_KEY = 'pos.terminalToken';

export interface PosConfig {
  /** URL del backend, p. ej. http://192.168.1.50:4000 o https://facturacion.midominio.com */
  serverUrl: string | null;
  companyId: number | null;
}

const EMPTY_CONFIG: PosConfig = { serverUrl: null, companyId: null };

export async function loadConfig(): Promise<PosConfig> {
  try {
    const raw = await AsyncStorage.getItem(CONFIG_KEY);
    return raw ? { ...EMPTY_CONFIG, ...JSON.parse(raw) } : EMPTY_CONFIG;
  } catch {
    return EMPTY_CONFIG;
  }
}

export async function saveConfig(config: PosConfig) {
  await AsyncStorage.setItem(CONFIG_KEY, JSON.stringify(config));
}

export interface Tokens {
  accessToken: string;
  refreshToken: string;
}

export async function loadTokens(): Promise<Tokens | null> {
  const [accessToken, refreshToken] = await Promise.all([
    SecureStore.getItemAsync(ACCESS_KEY),
    SecureStore.getItemAsync(REFRESH_KEY),
  ]);
  return accessToken && refreshToken ? { accessToken, refreshToken } : null;
}

export async function saveTokens(tokens: Tokens | null) {
  if (!tokens) {
    await Promise.all([SecureStore.deleteItemAsync(ACCESS_KEY), SecureStore.deleteItemAsync(REFRESH_KEY)]);
    return;
  }
  await Promise.all([
    SecureStore.setItemAsync(ACCESS_KEY, tokens.accessToken),
    SecureStore.setItemAsync(REFRESH_KEY, tokens.refreshToken),
  ]);
}

/** Token de equipo de caja (lo entrega el backend al canjear el código de vinculación). */
export async function loadTerminalToken() {
  return SecureStore.getItemAsync(TERMINAL_KEY);
}

export async function saveTerminalToken(token: string | null) {
  if (token) {
    await SecureStore.setItemAsync(TERMINAL_KEY, token);
  } else {
    await SecureStore.deleteItemAsync(TERMINAL_KEY);
  }
}
