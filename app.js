const SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbzY5mSFuqqP99aYIx7FK4nF78R18eFrtffQdEBen2c4UM1wqW5jN1z-Z_PW2okITNGA/exec'; 

let html5QrcodeScanner = null;
let paquetePausado = false;
let indiceEdicion = null;
let torchActive = false;
let currentFacingMode = "environment";

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
  
  document.getElementById('btnTorch').addEventListener('click', toggleTorch);
  document.getElementById('btnSwitchCam').addEventListener('click', switchCamera);
});

// ==========================================================================
// SISTEMA DE NOTIFICACIONES TOAST (UI/UX PRO MAX)
// ==========================================================================
function showToast(message, type = 'success', icon = null) {
  const container = document.getElementById('toastContainer');
  if (!container) return;

  const defaultIcons = {
    success: '✅',
    error: '❌',
    warning: '⚠️',
    info: 'ℹ️'
  };

  const toastIcon = icon || defaultIcons[type] || '🔔';

  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.innerHTML = `
    <span class="toast-icon">${toastIcon}</span>
    <span class="toast-message">${message}</span>
  `;

  container.appendChild(toast);

  setTimeout(() => {
    toast.style.animation = 'toastFadeOut 0.3s forwards';
    setTimeout(() => {
      if (toast.parentNode) {
        toast.parentNode.removeChild(toast);
      }
    }, 300);
  }, 3500);
}

// ==========================================================================
// LÓGICA DE TARIFARIO OFICIAL MRW (PESO -> CUPONES)
// ==========================================================================
function calcularCuponesPorPeso(pesoKg) {
  if (pesoKg <= 1.0) return 1;
  if (pesoKg <= 2.0) return 2;
  if (pesoKg <= 3.0) return 3;
  if (pesoKg <= 4.0) return 4;
  if (pesoKg <= 5.0) return 5;
  if (pesoKg <= 6.0) return 6;
  if (pesoKg <= 8.0) return 7;
  if (pesoKg <= 10.0) return 8;
  if (pesoKg <= 12.0) return 9;
  if (pesoKg <= 14.0) return 10;
  if (pesoKg <= 16.0) return 11;
  if (pesoKg <= 18.0) return 12;
  if (pesoKg <= 21.0) return 13;
  if (pesoKg <= 24.0) return 14;
  if (pesoKg <= 27.0) return 15;
  if (pesoKg <= 30.0) return 16;
  if (pesoKg <= 33.0) return 17;
  if (pesoKg <= 36.0) return 18;
  if (pesoKg <= 39.0) return 19;
  if (pesoKg <= 42.0) return 20;
  if (pesoKg <= 45.0) return 21;
  if (pesoKg <= 48.0) return 22;
  if (pesoKg <= 51.0) return 23;
  if (pesoKg <= 54.0) return 24;
  if (pesoKg <= 57.0) return 25;
  if (pesoKg <= 60.0) return 26;
  if (pesoKg <= 63.0) return 27;
  if (pesoKg <= 66.0) return 28;
  if (pesoKg <= 69.0) return 29;
  if (pesoKg <= 72.0) return 30;
  if (pesoKg <= 75.0) return 31;
  return 32;
}

// ==========================================================================
// TEMA OSCURO / CLARO
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
// CONTROL DE CÁMARA & MINI-BOTONES
// ==========================================================================
function iniciarCamara() {
  if (html5QrcodeScanner) {
    html5QrcodeScanner.stop().then(() => startScannerInstance()).catch(() => startScannerInstance());
  } else {
    startScannerInstance();
  }
}

function startScannerInstance() {
  html5QrcodeScanner = new Html5Qrcode("reader");
  html5QrcodeScanner.start(
    { facingMode: currentFacingMode },
    { fps: 15, qrbox: { width: 220, height: 220 } },
    (decodedText) => procesarTextoQR(decodedText),
    () => {}
  ).catch(() => {
    const statusMsg = document.getElementById('statusMsg');
    statusMsg.innerText = "Error: Permiso de cámara denegado.";
    statusMsg.style.color = "var(--primary)";
    showToast("Permiso de cámara denegado", "error");
  });
}

async function toggleTorch() {
  if (!html5QrcodeScanner) return;
  try {
    torchActive = !torchActive;
    await html5QrcodeScanner.applyVideoConstraints({
      advanced: [{ torch: torchActive }]
    });
    const btn = document.getElementById('btnTorch');
    btn.classList.toggle('active', torchActive);
    showToast(torchActive ? "Linterna encendida" : "Linterna apagada", "info", "🔦");
  } catch (err) {
    showToast("Linterna no disponible en este dispositivo", "warning");
    torchActive = false;
  }
}

function switchCamera() {
  currentFacingMode = (currentFacingMode === "environment") ? "user" : "environment";
  torchActive = false;
  document.getElementById('btnTorch').classList.remove('active');
  iniciarCamara();
  showToast("Cámara alternada", "info", "🔄");
}

// ==========================================================================
// VALIDACIÓN DE DUPLICADOS Y PARSER QR
// ==========================================================================
function esPaqueteDuplicado(numeroEnvio) {
  const cola = JSON.parse(localStorage.getItem('mrw_cola_paquetes') || '[]');
  return cola.some((item, idx) => item.numeroEnvio === numeroEnvio && idx !== indiceEdicion);
}

function procesarTextoQR(decodedText) {
  if (paquetePausado) return;

  const datos = decodedText.split(';');
  if (datos.length >= 15) {
    const numeroEnvio = datos[0] || '';

    if (esPaqueteDuplicado(numeroEnvio)) {
      paquetePausado = true;
      const statusMsg = document.getElementById('statusMsg');
      statusMsg.innerHTML = '⚠️ <strong>¡Atención!</strong> Paquete ' + numeroEnvio + ' ya escaneado.';
      statusMsg.style.color = "var(--warning)";

      showToast(`El paquete #${numeroEnvio} ya está en la lista`, "warning");

      setTimeout(() => {
        paquetePausado = false;
        statusMsg.innerHTML = '<span class="status-dot"></span> Cámara lista. Apunte al QR...';
        statusMsg.style.color = "var(--success)";
      }, 3000);
      return;
    }

    paquetePausado = true;

    document.getElementById('numeroEnvio').value = numeroEnvio;
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

    // 2. Detección de Peso, Formato y Cupones según Tarifario Oficial
    const peso = parseFloat(datos[22]) || 0;
    if (peso < 0.151) {
      document.getElementById('tipoPaquete').value = 'ESPECIAL';
    } else if (peso <= 0.500) {
      document.getElementById('tipoPaquete').value = 'SOBRE';
    } else {
      document.getElementById('tipoPaquete').value = 'PAQUETE';
    }

    let cuponesCalculados = calcularCuponesPorPeso(peso);

    // 3. Extracción de Precio Total y verificación de Cupones del QR
    let precioEncontrado = '';

    for (let i = datos.length - 2; i >= 10; i--) {
      const valActual = parseFloat(datos[i]);
      const valSig = parseInt(datos[i + 1], 10);

      if (!isNaN(valActual) && valActual > 0 && !isNaN(valSig) && valSig >= 1 && valSig <= 50) {
        precioEncontrado = valActual.toFixed(2);
        cuponesCalculados = valSig;
        break;
      }
    }

    // 4. Detección de Condición
    const tieneCodigoEspecial = datos[1] && datos[1].trim().length > 3;
    const esMontoCero = precioEncontrado === '' || parseFloat(precioEncontrado) === 0;

    if (tieneCodigoEspecial || esMontoCero) {
      document.getElementById('tipoEnvio').value = 'PREADQUIRIDO';
      document.getElementById('precio').value = '0.00';
      if (datos[28] && !isNaN(parseInt(datos[28]))) cuponesCalculados = parseInt(datos[28]);
    } else {
      const esCod = datos[19] === '1';
      document.getElementById('tipoEnvio').value = esCod ? 'COD' : 'PAGO';
      document.getElementById('precio').value = precioEncontrado;
    }

    document.getElementById('cupones').value = cuponesCalculados.toString();

    const statusMsg = document.getElementById('statusMsg');
    statusMsg.innerHTML = '✨ ¡QR Escaneado con Éxito!';
    statusMsg.style.color = "var(--accent-blue)";

    showToast(`Guía #${numeroEnvio} cargada al formulario`, "success", "📦");

    setTimeout(() => {
      paquetePausado = false;
      statusMsg.innerHTML = '<span class="status-dot"></span> Cámara lista. Apunte al QR...';
      statusMsg.style.color = "var(--success)";
    }, 2500);
  }
}

// ==========================================================================
// ALMACENAMIENTO LOCAL CON CONTROL ANTI-DUPLICADOS
// ==========================================================================
function guardarLocalmente(e) {
  e.preventDefault();

  const numeroEnvio = document.getElementById('numeroEnvio').value.trim();

  if (esPaqueteDuplicado(numeroEnvio)) {
    showToast(`El número de envío "${numeroEnvio}" ya existe en la lista`, "warning");
    return;
  }

  const hoy = new Date();
  const dia = String(hoy.getDate()).padStart(2, '0');
  const mes = String(hoy.getMonth() + 1).padStart(2, '0');
  const anio = hoy.getFullYear().toString().slice(-2);

  const paqueteData = {
    telefonoReceptor: document.getElementById('telefonoReceptor').value,
    numeroEnvio: numeroEnvio,
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
    showToast(`Paquete #${numeroEnvio} actualizado`, "info", "💾");
  } else {
    cola.push(paqueteData);
    showToast(`Paquete #${numeroEnvio} guardado localmente`, "success", "📥");
  }

  localStorage.setItem('mrw_cola_paquetes', JSON.stringify(cola));
  document.getElementById('registroForm').reset();
  actualizarContadorUI();

  const statusMsg = document.getElementById('statusMsg');
  statusMsg.innerHTML = '💾 Guardado en Memoria Local';
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
  const cola = JSON.parse(localStorage.getItem('mrw_cola_paquetes') || '[]');
  const paqueteEliminado = cola[index];
  
  cola.splice(index, 1);
  localStorage.setItem('mrw_cola_paquetes', JSON.stringify(cola));
  actualizarContadorUI();
  renderizarListaModal();
  showToast(`Paquete #${paqueteEliminado ? paqueteEliminado.numeroEnvio : ''} eliminado de la lista`, "info", "🗑️");
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
  showToast("Edición cancelada", "info");
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
      showToast("Error de red durante la sincronización", "error");
      break;
    }
  }

  localStorage.setItem('mrw_cola_paquetes', JSON.stringify(colaRestante));
  actualizarContadorUI();
  btnSync.innerHTML = '<span>🔄</span> Sincronizar';

  if (exitosos > 0) {
    showToast(`¡${exitosos} paquete(s) se cargaron con éxito a Google Sheets!`, "success", "🎉");
  }
}