# Facturación POS (Expo)

App de caja para terminales Android POS (probada contra Senraise H5 / POSH5-OS01, Android 8.1).
Se conecta al **backend existente** de facturación (`C:\facturacion\facturacion\apps\backend`) por HTTP:
nunca a la base de datos directamente.

## Qué hace

- Conectar con el servidor (IP de la PC servidor en la red local, o URL https en la nube).
- Iniciar sesión con los usuarios del sistema y elegir empresa.
- Vincular la terminal a una caja con el **código de vinculación** que genera un administrador en el sistema
  de escritorio (Caja > equipos), abrir y cerrar caja.
- Vender: buscar o escanear (el lector de barras que escribe y termina con Enter agrega el producto).
- Cobrar: consumidor final o cliente con nombre/RTN, efectivo (con cambio), tarjeta o transferencia.
- Emitir la factura (`POST /api/invoices`; el backend calcula totales, CAI y correlativo).
- Imprimir el ticket de 58 mm **directo en la impresora integrada, sin diálogo**, y reimprimir.

## Impresora Senraise

`modules/senraise-printer` es un módulo local de Expo (Kotlin) que se conecta al servicio del fabricante
`recieptservice.com.recieptservice/.service.PrinterService` (interfaz `PrinterInterface`). Los códigos
de transacción se tomaron del servicio instalado en la terminal (versión 8.0.5).

El diseño del ticket está en `src/lib/ticket.ts`. Los tamaños de letra (`PRINTER_TEXT_SIZE`) y el ancho
de la línea divisoria (`TICKET_COLUMNS`) son los primeros a ajustar después de imprimir la prueba
(Ajustes > Imprimir prueba).

En un teléfono común, o sin el servicio, la app funciona igual y muestra solo la vista previa.

## Compilar e instalar

No funciona en Expo Go (lleva código nativo). Dos opciones:

### A) Local, con la terminal conectada por USB

Requiere JDK 17 y el Android SDK (Android Studio). Con la depuración USB autorizada:

```bash
npx expo run:android
```

Compila, instala y abre la app en la terminal. APK de release: `npx expo prebuild -p android` y luego
`cd android && gradlew assembleRelease` (`android/app/build/outputs/apk/release/`).

### B) En la nube con EAS (sin instalar Android Studio)

Requiere una cuenta de Expo:

```bash
npx eas-cli@latest build -p android --profile preview
```

Descarga el APK del enlace e instálalo con `adb install archivo.apk`.

## Requisitos del servidor

- El backend escucha en `0.0.0.0:4000` (por defecto). Abre el puerto 4000 en el firewall de Windows de
  la PC servidor si la terminal no conecta.
- La terminal debe estar en la misma red (o VPN) que el backend, o el backend publicado en la nube con https.
- La licencia la valida el backend (la PC servidor debe estar activada).

## Desarrollo

```bash
npm run typecheck
npm run lint
```
