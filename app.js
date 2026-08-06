const SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbzY5mSFuqqP99aYIx7FK4nF78R18eFrtffQdEBen2c4UM1wqW5jN1z-Z_PW2okITNGA/exec'; 
let paquetePausado = false;
let indiceEdicion = null; // Guarda el índice si estamos modificando un paquete

document.addEventListener("DOMContentLoaded", () => {
  actualizarContadorUI();
  iniciarCamara();

  document.getElementById('registroForm').addEventListener('submit', guardarLocalmente);
  document.getElementById('btnSincronizar').addEventListener('click', sincronizarConSheets);
  document.getElementById('btnVerPendientes').addEventListener('click', abrirModalLista);
  document.getElementById('btnCloseModal').addEventListener('click', cerrarModalLista);
  document.getElementById('btnCancelarEdicion').addEventListener('click', cancelarEdicion);
});

// Parser de datos del código QR
function procesarTextoQR(decodedText) {
  if (paquetePausado) return;

  const datos = decodedText.split(';');
  if (datos.length >= 15) {
    paquetePausado = true;

    document.getElementById('numeroEnvio').value = datos[0] || '';
    document.getElementById('emisor').value = (datos[3] || '').toUpperCase();
    document.getElementById('receptor').value = (datos[8] || '').toUpperCase();
    document.getElementById('telefonoReceptor').value = datos[9] || '';

    if (datos[2]) {
      const fechaHora = datos[2].split(' ')[0];
      const p = fechaHora.split('-');
      if (p.length === 3) {
        document.getElementById('fechaEmision').value = `${p[2]}/${p[1]}/${p[0].slice(-2)}`;
      }
    }

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

    document.getElementById('precio').value = precioEncontrado;
    document.getElementById('cupones').value = cuponesEncontrados;

    const statusMsg = document.getElementById('statusMsg');
    statusMsg.innerText = "¡QR Detectado y Cargado!";
    statusMsg.style.color = "#007bff";

    setTimeout(() => {
      paquetePausado = false;
      statusMsg.innerText = "Cámara activa. Apunte al QR...";
      statusMsg.style.color = "var(--status-green)";
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
    statusMsg.innerText = "Error de acceso a cámara.";
    statusMsg.style.color = "red";
  });
}

// Guardar o Actualizar Paquete en LocalStorage
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
    // Modo Edición: Actualiza la posición existente
    cola[indiceEdicion] = paqueteData;
    indiceEdicion = null;
    document.getElementById('btnSubmitForm').innerText = '📥 Guardar Localmente';
    document.getElementById('btnSubmitForm').style.backgroundColor = 'var(--primary-red)';
    document.getElementById('btnCancelarEdicion').style.display = 'none';
  } else {
    // Modo Nuevo: Agrega a la cola
    cola.push(paqueteData);
  }

  localStorage.setItem('mrw_cola_paquetes', JSON.stringify(cola));
  document.getElementById('registroForm').reset();
  actualizarContadorUI();

  const statusMsg = document.getElementById('statusMsg');
  statusMsg.innerText = "Guardado en memoria local";
  statusMsg.style.color = "var(--status-green)";
}

function actualizarContadorUI() {
  const cola = JSON.parse(localStorage.getItem('mrw_cola_paquetes') || '[]');
  document.getElementById('lblPendientes').innerText = `Pendientes: ${cola.length}`;
  document.getElementById('btnSincronizar').disabled = cola.length === 0;
}

// Modal y Gestión de Lista
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
    contenedor.innerHTML = '<p style="text-align:center; color:#777;">No hay paquetes pendientes por enviar.</p>';
    return;
  }

  let html = '';
  cola.forEach((p, index) => {
    html += `
      <div class="item-card">
        <div class="item-card-title">📦 Nº: ${p.numeroEnvio} (${p.tipoEnvio})</div>
        <div class="item-card-detail"><strong>Emisor:</strong> ${p.emisor}</div>
        <div class="item-card-detail"><strong>Receptor:</strong> ${p.receptor} (${p.telefonoReceptor})</div>
        <div class="item-card-detail"><strong>Monto / Cupones:</strong> Bs. ${p.precio} / ${p.cupones} cupón(es)</div>
        <div class="item-card-detail"><strong>Tipo:</strong> ${p.tipoPaquete} | <strong>Fecha Emisión:</strong> ${p.fechaEmision}</div>
        <div class="item-actions">
          <button class="btn-item-edit" onclick="prepararEdicion(${index})">✏️ Editar</button>
          <button class="btn-item-delete" onclick="eliminarPaquete(${index})">🗑️ Borrar</button>
        </div>
      </div>
    `;
  });

  contenedor.innerHTML = html;
}

function eliminarPaquete(index) {
  if (confirm("¿Estás seguro de eliminar este paquete de la lista local?")) {
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

  // Cambiar botones UI
  const btnSubmit = document.getElementById('btnSubmitForm');
  btnSubmit.innerText = '💾 Actualizar Cambios';
  btnSubmit.style.backgroundColor = 'var(--orange-edit)';
  document.getElementById('btnCancelarEdicion').style.display = 'block';

  cerrarModalLista();
  window.scrollTo({ top: document.getElementById('registroForm').offsetTop, behavior: 'smooth' });
}

function cancelarEdicion() {
  indiceEdicion = null;
  document.getElementById('registroForm').reset();
  const btnSubmit = document.getElementById('btnSubmitForm');
  btnSubmit.innerText = '📥 Guardar Localmente';
  btnSubmit.style.backgroundColor = 'var(--primary-red)';
  document.getElementById('btnCancelarEdicion').style.display = 'none';
}

// Sincronización masiva con Google Sheets
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
  btnSync.innerText = "🔄 Sincronizar";

  if (exitosos > 0) {
    alert(`¡Se sincronizaron ${exitosos} paquete(s) con Google Sheets exitosamente!`);
  }
}