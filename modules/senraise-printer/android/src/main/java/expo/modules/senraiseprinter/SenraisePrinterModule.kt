package expo.modules.senraiseprinter

import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.content.ServiceConnection
import android.graphics.BitmapFactory
import android.os.DeadObjectException
import android.os.IBinder
import android.os.Parcel
import android.util.Base64
import expo.modules.kotlin.exception.CodedException
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.util.concurrent.CountDownLatch
import java.util.concurrent.TimeUnit

/**
 * Impresora térmica integrada de las terminales Senraise (H5, H10...).
 *
 * El fabricante expone el servicio `recieptservice.com.recieptservice/.service.PrinterService`
 * con la interfaz AIDL `PrinterInterface`. En vez de copiar su .aidl, se llama al binder a mano
 * con los mismos códigos de transacción (tomados del servicio instalado, versión 8.0.5).
 */
class SenraisePrinterModule : Module() {
  private val context: Context
    get() = requireNotNull(appContext.reactContext)

  @Volatile private var binder: IBinder? = null
  private var connection: ServiceConnection? = null
  private val lock = Any()

  override fun definition() = ModuleDefinition {
    Name("SenraisePrinter")

    /** true si la terminal tiene instalado el servicio de impresión Senraise. */
    AsyncFunction("isAvailable") {
      try {
        context.packageManager.getPackageInfo(SERVICE_PACKAGE, 0)
        true
      } catch (_: Exception) {
        false
      }
    }

    AsyncFunction("getServiceVersion") {
      call(TX_GET_SERVICE_VERSION, {}) { it.readString() }
    }

    /**
     * Imprime una lista de comandos en orden con una sola conexión al servicio.
     * Cada comando es un objeto `{ type, ... }` (ver src/SenraisePrinter.types.ts).
     */
    AsyncFunction("print") { commands: List<Map<String, Any?>> ->
      for (command in commands) {
        run(command)
      }
    }

    OnDestroy {
      disconnect()
    }
  }

  private fun run(command: Map<String, Any?>) {
    when (val type = command["type"] as? String) {
      "text" -> call<Unit>(TX_PRINT_TEXT, { it.writeString(string(command, "text")) })
      "align" -> call<Unit>(TX_SET_ALIGNMENT, { it.writeInt(int(command, "value")) })
      "size" -> call<Unit>(TX_SET_TEXT_SIZE, { it.writeFloat(float(command, "value")) })
      "bold" -> call<Unit>(TX_SET_TEXT_BOLD, { it.writeInt(flag(command, "value")) })
      "doubleWidth" -> call<Unit>(TX_SET_TEXT_DOUBLE_WIDTH, { it.writeInt(flag(command, "value")) })
      "doubleHeight" -> call<Unit>(TX_SET_TEXT_DOUBLE_HEIGHT, { it.writeInt(flag(command, "value")) })
      "lineHeight" -> call<Unit>(TX_SET_LINE_HEIGHT, { it.writeFloat(float(command, "value")) })
      "dark" -> call<Unit>(TX_SET_DARK, { it.writeInt(int(command, "value")) })
      "feed" -> call<Unit>(TX_NEXT_LINE, { it.writeInt(int(command, "lines")) })
      "table" -> call<Unit>(TX_PRINT_TABLE_TEXT, {
        it.writeStringArray(list(command, "texts").map { value -> value?.toString() ?: "" }.toTypedArray())
        it.writeIntArray(list(command, "weights").map { value -> (value as Number).toInt() }.toIntArray())
        it.writeIntArray(list(command, "aligns").map { value -> (value as Number).toInt() }.toIntArray())
      })
      "qr" -> call<Unit>(TX_PRINT_QR_CODE, {
        it.writeString(string(command, "text"))
        it.writeInt(int(command, "size"))
        it.writeInt(int(command, "level"))
      })
      "barcode" -> call<Unit>(TX_PRINT_BAR_CODE, {
        it.writeString(string(command, "text"))
        it.writeInt(int(command, "symbology"))
        it.writeInt(int(command, "height"))
        it.writeInt(int(command, "width"))
      })
      "image" -> {
        val bytes = Base64.decode(string(command, "base64"), Base64.DEFAULT)
        val bitmap = BitmapFactory.decodeByteArray(bytes, 0, bytes.size)
          ?: throw PrinterException("La imagen no es válida.")
        call<Unit>(TX_PRINT_BITMAP, {
          // Parcelable en AIDL: 1 = no nulo, luego el objeto.
          it.writeInt(1)
          bitmap.writeToParcel(it, 0)
        })
      }
      "raw" -> call<Unit>(TX_PRINT_EPSON, { it.writeByteArray(Base64.decode(string(command, "base64"), Base64.DEFAULT)) })
      "beginWork" -> call<Unit>(TX_BEGIN_WORK, {})
      "endWork" -> call<Unit>(TX_END_WORK, {})
      else -> throw PrinterException("Comando de impresión desconocido: $type")
    }
  }

  private fun <T> call(code: Int, write: (Parcel) -> Unit, read: ((Parcel) -> T)? = null): T? {
    val target = connect()
    val data = Parcel.obtain()
    val reply = Parcel.obtain()
    try {
      data.writeInterfaceToken(DESCRIPTOR)
      write(data)
      if (!target.transact(code, data, reply, 0)) {
        throw PrinterException("El servicio de impresión no aceptó el comando ($code).")
      }
      reply.readException()
      return read?.invoke(reply)
    } catch (_: DeadObjectException) {
      binder = null
      throw PrinterException("Se perdió la conexión con la impresora. Intenta de nuevo.")
    } finally {
      data.recycle()
      reply.recycle()
    }
  }

  /** Se conecta al servicio (una vez) y espera la conexión fuera del hilo principal. */
  private fun connect(): IBinder {
    binder?.takeIf { it.isBinderAlive }?.let { return it }

    synchronized(lock) {
      binder?.takeIf { it.isBinderAlive }?.let { return it }
      disconnect()

      val latch = CountDownLatch(1)
      val newConnection = object : ServiceConnection {
        override fun onServiceConnected(name: ComponentName?, service: IBinder?) {
          binder = service
          latch.countDown()
        }

        override fun onServiceDisconnected(name: ComponentName?) {
          binder = null
        }
      }

      val intent = Intent().apply { component = ComponentName(SERVICE_PACKAGE, SERVICE_CLASS) }
      val bound = try {
        context.bindService(intent, newConnection, Context.BIND_AUTO_CREATE)
      } catch (_: SecurityException) {
        false
      }
      if (!bound) {
        throw PrinterException("Esta terminal no tiene el servicio de impresión Senraise.")
      }
      connection = newConnection

      if (!latch.await(5, TimeUnit.SECONDS)) {
        throw PrinterException("La impresora no respondió. Revisa que la terminal esté encendida y con papel.")
      }
      return binder ?: throw PrinterException("No se pudo conectar con la impresora.")
    }
  }

  private fun disconnect() {
    connection?.let {
      try {
        context.unbindService(it)
      } catch (_: Exception) {
      }
    }
    connection = null
    binder = null
  }

  private fun string(command: Map<String, Any?>, key: String) = command[key]?.toString() ?: ""
  private fun int(command: Map<String, Any?>, key: String) = (command[key] as? Number)?.toInt() ?: 0
  private fun float(command: Map<String, Any?>, key: String) = (command[key] as? Number)?.toFloat() ?: 0f
  private fun flag(command: Map<String, Any?>, key: String) = if (command[key] == true) 1 else 0
  private fun list(command: Map<String, Any?>, key: String) = command[key] as? List<*> ?: emptyList<Any?>()

  class PrinterException(message: String) : CodedException("ERR_PRINTER", message, null)

  companion object {
    private const val SERVICE_PACKAGE = "recieptservice.com.recieptservice"
    private const val SERVICE_CLASS = "recieptservice.com.recieptservice.service.PrinterService"
    private const val DESCRIPTOR = "recieptservice.com.recieptservice.PrinterInterface"

    // Códigos de PrinterInterface$Stub (orden de la interfaz AIDL del fabricante).
    private const val TX_PRINT_EPSON = 1
    private const val TX_GET_SERVICE_VERSION = 2
    private const val TX_PRINT_TEXT = 3
    private const val TX_PRINT_BITMAP = 4
    private const val TX_PRINT_BAR_CODE = 5
    private const val TX_PRINT_QR_CODE = 6
    private const val TX_SET_ALIGNMENT = 7
    private const val TX_SET_TEXT_SIZE = 8
    private const val TX_NEXT_LINE = 9
    private const val TX_PRINT_TABLE_TEXT = 10
    private const val TX_SET_TEXT_BOLD = 11
    private const val TX_BEGIN_WORK = 12
    private const val TX_END_WORK = 13
    private const val TX_SET_DARK = 14
    private const val TX_SET_LINE_HEIGHT = 15
    private const val TX_SET_TEXT_DOUBLE_WIDTH = 16
    private const val TX_SET_TEXT_DOUBLE_HEIGHT = 17
  }
}
