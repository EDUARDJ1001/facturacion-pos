import NfcReader, { type NfcStatus } from '../../modules/nfc-reader';

/** Estado del NFC del equipo (none en web, Expo Go o equipos sin NFC). */
export async function nfcStatus(): Promise<NfcStatus> {
  if (!NfcReader) {
    return 'none';
  }
  try {
    return await NfcReader.getStatus();
  } catch {
    return 'none';
  }
}
