package expo.modules.nfcreader

import android.nfc.NfcAdapter
import android.nfc.Tag
import expo.modules.kotlin.exception.CodedException
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

/**
 * Lector NFC en "reader mode": avisa cuando se acerca una tarjeta sin contacto o un teléfono
 * que emula una tarjeta (billetera). Solo informa que hubo una tarjeta: no lee ningún dato
 * de pago. Se usa para simular el cobro con tarjeta en las pruebas del POS.
 */
class NfcReaderModule : Module() {
  @Volatile private var reading = false

  private val adapter: NfcAdapter?
    get() = appContext.reactContext?.let { NfcAdapter.getDefaultAdapter(it) }

  override fun definition() = ModuleDefinition {
    Name("NfcReader")

    Events("onTag")

    /** none: el equipo no tiene NFC · off: lo tiene apagado · on: listo. */
    AsyncFunction("getStatus") {
      val nfc = adapter
      when {
        nfc == null -> "none"
        !nfc.isEnabled -> "off"
        else -> "on"
      }
    }

    AsyncFunction("start") {
      val nfc = adapter ?: throw NfcException("Este equipo no tiene NFC.")
      if (!nfc.isEnabled) {
        throw NfcException("El NFC está apagado. Actívalo en los ajustes de la terminal.")
      }
      reading = true
      enable()
    }

    AsyncFunction("stop") {
      reading = false
      disable()
    }

    // Android apaga el reader mode al salir de la app; se vuelve a activar al regresar.
    OnActivityEntersForeground {
      if (reading) {
        enable()
      }
    }

    OnDestroy {
      reading = false
      disable()
    }
  }

  private fun enable() {
    val activity = appContext.currentActivity ?: return
    val nfc = adapter ?: return
    activity.runOnUiThread {
      nfc.enableReaderMode(activity, { tag -> onTag(tag) }, READER_FLAGS, null)
    }
  }

  private fun disable() {
    val activity = appContext.currentActivity ?: return
    val nfc = adapter ?: return
    activity.runOnUiThread {
      try {
        nfc.disableReaderMode(activity)
      } catch (_: Exception) {
      }
    }
  }

  private fun onTag(tag: Tag) {
    if (!reading) {
      return
    }
    sendEvent(
      "onTag",
      mapOf(
        // Identificador de la sesión NFC (en los teléfonos cambia en cada acercamiento).
        "id" to tag.id.joinToString("") { "%02X".format(it) },
        "techs" to tag.techList.map { it.substringAfterLast('.') }
      )
    )
  }

  class NfcException(message: String) : CodedException("ERR_NFC", message, null)

  companion object {
    private const val READER_FLAGS =
      NfcAdapter.FLAG_READER_NFC_A or
        NfcAdapter.FLAG_READER_NFC_B or
        NfcAdapter.FLAG_READER_NFC_F or
        NfcAdapter.FLAG_READER_NFC_V or
        NfcAdapter.FLAG_READER_SKIP_NDEF_CHECK
  }
}
