import { NativeModule, requireOptionalNativeModule } from 'expo';

import type { PrintCommand } from './SenraisePrinter.types';

declare class SenraisePrinterModule extends NativeModule<{}> {
  isAvailable(): Promise<boolean>;
  getServiceVersion(): Promise<string | null>;
  print(commands: PrintCommand[]): Promise<void>;
}

// Opcional: en Expo Go, web o un teléfono común no existe y la app muestra el ticket en pantalla.
export default requireOptionalNativeModule<SenraisePrinterModule>('SenraisePrinter');
