# 📦 MRW Scanner - Control de Recepción & Sincronizador de Sheets

Aplicación web responsiva (*Mobile-First*) diseñada para automatizar y agilizar el proceso de recepción e inventariado de paquetes en agencias de **MRW**. 

Permite escanear códigos QR de guías de envío directamente utilizando la cámara del teléfono, procesar automáticamente los datos del paquete, almacenarlos en memoria local (*Offline-First*) y sincronizarlos masivamente con **Google Sheets** mediante **Google Apps Script**.

---

## 🚀 Características Principales

* 📷 **Escáner Continuo en Tiempo Real:** Lectura rápida mediante la cámara del smartphone usando la librería `html5-qrcode`.
* 🔦 **Controles de Cámara Flotantes:** Botones integrados para encender/apagar la linterna (flash) y alternar entre cámaras.
* 🧠 **Parseo Inteligente de QR:**
  * **Formato automático:** Clasifica automáticamente entre `ESPECIAL` (pesos < 0.151 kg), `SOBRE` (≤ 0.500 kg) y `PAQUETE`.
  * **Condición de pago:** Detecta automáticamente `COD` (Cobro en Destino), `PAGO` (Pago en Origen) y `PREADQUIRIDO` (envíos corporativos/plataformas con montos en 0.00 o códigos especiales).
  * **Extracción limpia:** Limpia automáticamente prefijos internacionales en números telefónicos (ej. `+58`).
* 📥 **Almacenamiento Offline (LocalStorage):** Permite guardar múltiples registros al instante sin esperar la respuesta de la red, ideal para jornadas de alto volumen de paquetes.
* 🚫 **Control Anti-Duplicados:** Previene el doble escaneo o registro accidental de un mismo número de envío en la cola local.
* 📋 **Gestor de Cola de Envíos (Modal):** Interfaz para inspeccionar la lista de paquetes pendientes por sincronizar, con opciones para **Editar** datos o **Borrar** registros.
* 🔄 **Sincronización Masiva:** Envío secuencial con un clic hacia la hoja de cálculo de Google.
* 🌓 **Interfaz UI/UX Pro Max:** Diseño fluido, responsivo, con soporte nativo para **Modo Oscuro / Modo Claro** (con persistencia de preferencia).

---

## 🛠️ Tecnologías Utilizadas

* **Frontend:** HTML5, CSS3 (Variables CSS, Flexbox, Grid, Glassmorphism, CSS Animations), JavaScript Vanilla (ES6+, LocalStorage, Fetch API, Async/Await).
* **Librerías:** [Html5-QRCode](https://github.com/mebjas/html5-qrcode) para la captura y decodificación de video.
* **Backend / Database:** Google Apps Script + Google Sheets API.

---

## 📂 Estructura del Proyecto

```text
mrw-scanner-app/
│
├── index.html     # Estructura semántica HTML5 y modales UI
├── styles.css     # Estilos CSS, variables de color y temas (Light/Dark)
├── app.js         # Lógica principal, parser QR, escáner, almacenamiento y sync
└── README.md      # Documentación del proyecto
```

---

## ⚙️ Configuración e Instalación

### 1. Configurar la Base de Datos (Google Sheets + Apps Script)

1. Crea una hoja de cálculo en **Google Sheets** con los siguientes encabezados comenzando en la **Columna B**:
   * `B: Número tlf recep`
   * `C: Número Tracking`
   * `D: Formato`
   * `E: Tipo`
   * `F: Cupones`
   * `G: precio`
   * `H: emisor`
   * `I: receptor`
   * `J: fecha de emision`
   * `K: fecha de recepcion`

2. Ve a **Extensiones > Apps Script** (o entra en [script.google.com](https://script.google.com/)) y pega el siguiente código:

```javascript
function doPost(e) {
  try {
    var SPREADSHEET_ID = "TU_SPREADSHEET_ID_AQUI"; 
    var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    var sheet = ss.getSheets()[0];
    
    var data = JSON.parse(e.postData.contents);
    
    sheet.appendRow([
      "", 
      data.telefonoReceptor,
      data.numeroEnvio,
      data.tipoPaquete,
      data.tipoEnvio,
      data.cupones,
      data.precio,
      data.emisor,
      data.receptor,
      data.fechaEmision,
      data.fechaRecepcion
    ]);
    
    return ContentService.createTextOutput("Éxito").setMimeType(ContentService.MimeType.TEXT);
  } catch(error) {
    return ContentService.createTextOutput("Error: " + error.message).setMimeType(ContentService.MimeType.TEXT);
  }
}
```

3. Haz clic en **Implementar > Nueva implementación**.
   * **Tipo:** Aplicación web.
   * **Ejecutar como:** Yo.
   * **Quién tiene acceso:** Cualquier persona (*Anyone*).
4. Copia la **URL de la aplicación web** generada.

---

### 2. Configurar el Frontend

1. Clona este repositorio:
   ```bash
   git clone https://github.com/tu-usuario/mrw-scanner-app.git
   cd mrw-scanner-app
   ```
2. Abre el archivo `app.js` y reemplaza el valor de la constante `SCRIPT_URL` en la primera línea por tu URL de Google Apps Script:
   ```javascript
   const SCRIPT_URL = 'https://script.google.com/macros/s/TU_SCRIPT_ID/exec';
   ```
3. Despliega la aplicación en cualquier servidor estático con soporte **HTTPS** (necesario para dar acceso a la cámara en navegadores móviles):
   * **GitHub Pages**
   * **Vercel**
   * **Netlify**

---

## 📱 Uso de la Aplicación

1. **Escanear:** Abre la aplicación en el navegador del teléfono. Apunta la cámara al código QR de la etiqueta MRW.
2. **Validar:** Los campos del formulario se rellenarán automáticamente. Si el paquete requiere ajustes, puedes modificarlos manualmente.
3. **Guardar Localmente:** Presiona **"📥 Guardar Localmente"**. El registro quedará almacenado en la memoria de tu dispositivo y la cámara volverá a estar lista inmediatamente para el siguiente paquete.
4. **Revisar / Editar:** Presiona **"Ver Lista 📋"** para inspeccionar la cola de envíos pendientes, editar errores o eliminar lecturas incorrectas.
5. **Sincronizar:** Al finalizar la jornada o tanda de recepción, presiona **"🔄 Sincronizar"** para enviar todos los datos acumulados a tu hoja de Google Sheets.

---

## 📝 Licencia

Este proyecto está bajo la Licencia MIT. Libre para uso, modificación y distribución.
