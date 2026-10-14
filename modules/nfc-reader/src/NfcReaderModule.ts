import { NativeModule, requireOptionalNativeModule } from 'expo';

export type NfcStatus = 'none' | 'off' | 'on';

export interface NfcTagEvent {
  id: string;
  techs: string[];
}

type NfcReaderEvents = {
  onTag: (event: NfcTagEvent) => void;
};

declare class NfcReaderModule extends NativeModule<NfcReaderEvents> {
  getStatus(): Promise<NfcStatus>;
  start(): Promise<void>;
  stop(): Promise<void>;
}

// Opcional: no existe en web ni en Expo Go.
export default requireOptionalNativeModule<NfcReaderModule>('NfcReader');
