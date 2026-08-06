const SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbzY5mSFuqqP99aYIx7FK4nF78R18eFrtffQdEBen2c4UM1wqW5jN1z-Z_PW2okITNGA/exec'; 
let paquetePausado = false;
let indiceEdicion = null;

document.addEventListener("DOMContentLoaded", () => {
  initTheme();
  actualizarContadorUI();
  iniciarCamara();

  document.getElementById('registroForm').addEventListener('submit', guardarLocalmente);
  document.getElementById('btnSincronizar').addEventListener('click', sincronizarConSheets);
  document.getElementById('btnVerPendientes').addEventListener('click', abrirModalLista);
  document.getElementById('btnCloseModal').addEventListener('click', cerrarModalLista);
  document.getElementById('btnCancelarEdicion').addEventListener('click', cancelarEdicion);
  document.getElementById('btnThemeToggle').addEventListener('click', toggleTheme);
});

// ==========================================================================
// GESTIÓN DE TEMA (MODO OSCURO / CLARO)
// ==========================================================================
function initTheme() {
  const savedTheme = localStorage.getItem('mrw_theme') || 'light';
  document.documentElement.setAttribute('data-theme', savedTheme);
  updateThemeIcon(savedTheme);
}

function toggleTheme() {
  const currentTheme = document.documentElement.getAttribute('data-theme');
  const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', newTheme);
  localStorage.setItem('mrw_theme', newTheme);
  updateThemeIcon(newTheme);
}

function updateThemeIcon(theme) {
  document.getElementById('themeIcon').innerText = theme === 'dark' ? '☀️' : '🌙';
}

// ==========================================================================
// ESCÁNER Y PARSER DE CÓDIGO QR
// ==========================================================================
function procesarTextoQR(decodedText) {
  if (paquetePausado) return;

  const datos = decodedText.split(';');
  if (datos.length >= 15) {
    paquetePausado = true;

    document.getElementById('numeroEnvio').value = datos[0] || '';
    document.getElementById('emisor').value = (datos[3] || '').toUpperCase();
    document.getElementById('receptor').value = (datos[8] || '').toUpperCase();

    let tlf = datos[9] || '';
    if (tlf.startsWith('+58')) tlf = '0' + tlf.slice(3);
    document.getElementById('telefonoReceptor').value = tlf;

    // 1. Detección de Fecha
    if (datos[2]) {
      const fechaHora = datos[2].split(' ')[0];
      const p = fechaHora.split('-');
      if (p.length === 3) {
        document.getElementById('fechaEmision').value = `${p[2]}/${p[1]}/${p[0].slice(-2)}`;
      }
    }

    // 2. Detección de Peso y Formato (ESPECIAL / SOBRE / PAQUETE)
    const peso = parseFloat(datos[22]) || 0;
    if (peso < 0.151) {
      document.getElementById('tipoPaquete').value = 'ESPECIAL';
    } else if (peso <= 0.500) {
      document.getElementById('tipoPaquete').value = 'SOBRE';
    } else {
      document.getElementById('tipoPaquete').value = 'PAQUETE';
    }

    // 3. Extracción de Precio y Cupones
    let precioEncontrado = '';
    let cuponesEncontrados = '1';

    for (let i = datos.length - 2; i >= 10; i--) {
      const valActual = parseFloat(datos[i]);
      const valSig = parseInt(datos[i + 1], 10);

      if (!isNaN(valActual) && valActual > 0 && !isNaN(valSig) && valSig >= 1 && valSig <= 50) {
        precioEncontrado = valActual.toFixed(2);
        cuponesEncontrados = valSig.toString();
        break;
      }
    }

    // 4. Detección de Condición (COD / PAGO / PREADQUIRIDO)
    const tieneCodigoEspecial = datos[1] && datos[1].trim().length > 3;
    const esMontoCero = precioEncontrado === '' || parseFloat(precioEncontrado) === 0;

    if (tieneCodigoEspecial || esMontoCero) {
      document.getElementById('tipoEnvio').value = 'PREADQUIRIDO';
      document.getElementById('precio').value = '0.00';
      if (datos[28] && !isNaN(parseInt(datos[28]))) cuponesEncontrados = datos[28];
    } else {
      const esCod = datos[19] === '1';
      document.getElementById('tipoEnvio').value = esCod ? 'COD' : 'PAGO';
      document.getElementById('precio').value = precioEncontrado;
    }

    document.getElementById('cupones').value = cuponesEncontrados;

    const statusMsg = document.getElementById('statusMsg');
    statusMsg.innerHTML = '<span class="status-dot"></span> ¡QR Escaneado con Éxito!';
    statusMsg.style.color = "var(--accent-blue)";

    setTimeout(() => {
      paquetePausado = false;
      statusMsg.innerHTML = '<span class="status-dot"></span> Cámara lista. Apunte al QR...';
      statusMsg.style.color = "var(--success)";
    }, 2500);
  }
}

function iniciarCamara() {
  const html5QrcodeScanner = new Html5Qrcode("reader");
  html5QrcodeScanner.start(
    { facingMode: "environment" },
    { fps: 15, qrbox: { width: 220, height: 220 } },
    (decodedText) => procesarTextoQR(decodedText),
    () => {}
  ).catch(() => {
    const statusMsg = document.getElementById('statusMsg');
    statusMsg.innerText = "Error: Permiso de cámara denegado.";
    statusMsg.style.color = "var(--primary)";
  });
}

// ==========================================================================
// ALMACENAMIENTO Y EDICIÓN LOCAL
// ==========================================================================
function guardarLocalmente(e) {
  e.preventDefault();

  const hoy = new Date();
  const dia = String(hoy.getDate()).padStart(2, '0');
  const mes = String(hoy.getMonth() + 1).padStart(2, '0');
  const anio = hoy.getFullYear().toString().slice(-2);

  const paqueteData = {
    telefonoReceptor: document.getElementById('telefonoReceptor').value,
    numeroEnvio: document.getElementById('numeroEnvio').value,
    tipoPaquete: document.getElementById('tipoPaquete').value,
    tipoEnvio: document.getElementById('tipoEnvio').value,
    cupones: document.getElementById('cupones').value,
    precio: document.getElementById('precio').value,
    emisor: document.getElementById('emisor').value,
    receptor: document.getElementById('receptor').value,
    fechaEmision: document.getElementById('fechaEmision').value,
    fechaRecepcion: `${dia}/${mes}/${anio}`
  };

  const cola = JSON.parse(localStorage.getItem('mrw_cola_paquetes') || '[]');

  if (indiceEdicion !== null) {
    cola[indiceEdicion] = paqueteData;
    indiceEdicion = null;
    document.getElementById('btnSubmitForm').innerHTML = '<span>📥</span> Guardar Localmente';
    document.getElementById('btnCancelarEdicion').style.display = 'none';
  } else {
    cola.push(paqueteData);
  }

  localStorage.setItem('mrw_cola_paquetes', JSON.stringify(cola));
  document.getElementById('registroForm').reset();
  actualizarContadorUI();

  const statusMsg = document.getElementById('statusMsg');
  statusMsg.innerHTML = '<span class="status-dot"></span> Guardado en Memoria Local';
  statusMsg.style.color = "var(--success)";
}

function actualizarContadorUI() {
  const cola = JSON.parse(localStorage.getItem('mrw_cola_paquetes') || '[]');
  document.getElementById('lblPendientes').innerText = `Pendientes: ${cola.length}`;
  document.getElementById('btnSincronizar').disabled = cola.length === 0;
}

// ==========================================================================
// MODAL DE GESTIÓN Y LISTA
// ==========================================================================
function abrirModalLista() {
  renderizarListaModal();
  document.getElementById('modalLista').style.display = 'flex';
}

function cerrarModalLista() {
  document.getElementById('modalLista').style.display = 'none';
}

function renderizarListaModal() {
  const contenedor = document.getElementById('contenedorLista');
  const cola = JSON.parse(localStorage.getItem('mrw_cola_paquetes') || '[]');

  if (cola.length === 0) {
    contenedor.innerHTML = '<p style="text-align:center; color:var(--text-muted); padding:20px;">No hay envíos pendientes por sincronizar.</p>';
    return;
  }

  let html = '';
  cola.forEach((p, index) => {
    html += `
      <div class="item-card">
        <div class="item-header">
          <span class="item-code">#${p.numeroEnvio}</span>
          <span class="item-badge">${p.tipoEnvio} | ${p.tipoPaquete}</span>
        </div>
        <div class="item-detail"><strong>Receptor:</strong> ${p.receptor} (${p.telefonoReceptor})</div>
        <div class="item-detail"><strong>Emisor:</strong> ${p.emisor}</div>
        <div class="item-detail"><strong>Monto / Cupones:</strong> Bs. ${p.precio} (${p.cupones} cup)</div>
        <div class="item-actions">
          <button class="btn-action-edit" onclick="prepararEdicion(${index})">✏️ Editar</button>
          <button class="btn-action-delete" onclick="eliminarPaquete(${index})">🗑️ Borrar</button>
        </div>
      </div>
    `;
  });

  contenedor.innerHTML = html;
}

function eliminarPaquete(index) {
  if (confirm("¿Deseas eliminar este registro de la lista local?")) {
    const cola = JSON.parse(localStorage.getItem('mrw_cola_paquetes') || '[]');
    cola.splice(index, 1);
    localStorage.setItem('mrw_cola_paquetes', JSON.stringify(cola));
    actualizarContadorUI();
    renderizarListaModal();
  }
}

function prepararEdicion(index) {
  const cola = JSON.parse(localStorage.getItem('mrw_cola_paquetes') || '[]');
  const p = cola[index];

  if (!p) return;

  indiceEdicion = index;

  document.getElementById('telefonoReceptor').value = p.telefonoReceptor;
  document.getElementById('numeroEnvio').value = p.numeroEnvio;
  document.getElementById('tipoPaquete').value = p.tipoPaquete;
  document.getElementById('tipoEnvio').value = p.tipoEnvio;
  document.getElementById('cupones').value = p.cupones;
  document.getElementById('precio').value = p.precio;
  document.getElementById('emisor').value = p.emisor;
  document.getElementById('receptor').value = p.receptor;
  document.getElementById('fechaEmision').value = p.fechaEmision;

  const btnSubmit = document.getElementById('btnSubmitForm');
  btnSubmit.innerHTML = '<span>💾</span> Actualizar Cambios';
  document.getElementById('btnCancelarEdicion').style.display = 'block';

  cerrarModalLista();
  window.scrollTo({ top: document.getElementById('registroForm').offsetTop, behavior: 'smooth' });
}

function cancelarEdicion() {
  indiceEdicion = null;
  document.getElementById('registroForm').reset();
  const btnSubmit = document.getElementById('btnSubmitForm');
  btnSubmit.innerHTML = '<span>📥</span> Guardar Localmente';
  document.getElementById('btnCancelarEdicion').style.display = 'none';
}

// ==========================================================================
// SINCRONIZACIÓN CON GOOGLE SHEETS
// ==========================================================================
async function sincronizarConSheets() {
  const cola = JSON.parse(localStorage.getItem('mrw_cola_paquetes') || '[]');
  if (cola.length === 0) return;

  const btnSync = document.getElementById('btnSincronizar');
  btnSync.disabled = true;

  let exitosos = 0;
  const colaRestante = [...cola];

  for (let i = 0; i < cola.length; i++) {
    btnSync.innerText = `Enviando ${i + 1}/${cola.length}...`;
    try {
      await fetch(SCRIPT_URL, {
        method: 'POST',
        mode: 'no-cors',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(cola[i])
      });
      exitosos++;
      colaRestante.shift(); 
    } catch (err) {
      console.error("Error al enviar fila:", err);
      break;
    }
  }

  localStorage.setItem('mrw_cola_paquetes', JSON.stringify(colaRestante));
  actualizarContadorUI();
  btnSync.innerHTML = '<span>🔄</span> Sincronizar';

  if (exitosos > 0) {
    alert(`¡Se sincronizaron ${exitosos} paquete(s) con Google Sheets exitosamente!`);
  }
}