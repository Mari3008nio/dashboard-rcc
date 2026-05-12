import React, { useState, useEffect, useMemo } from "react";
import { fetchSeguro } from "../utils/api";
import { PlusCircle, Save, Trash2 } from "lucide-react";
import html2pdf from "html2pdf.js";

export default function Cotizacion({ clientePreCargado }) {
  const [cliente, setCliente] = useState({ id: 0, nombre: "", atencion: "" });
  const [partidas, setPartidas] = useState([
    { id: crypto.randomUUID(), concepto: "", cantidad: 1, precio_unitario: "" }
  ]);
  const [catalogo, setCatalogo] = useState({});
  const [notificacion, setNotificacion] = useState({
    mostrar: false,
    tipo: "",
    mensaje: "",
  });
  
  // ESTA ES LA MAGIA: Un interruptor que convierte inputs en texto para la foto
  const [isPdfMode, setIsPdfMode] = useState(false);

  const fechaActual = new Date().toLocaleDateString();

  useEffect(() => {
    const cargarCatalogo = async () => {
      try {
        const respuesta = await fetchSeguro(
          "https://astonishing-determination-production.up.railway.app/api/v1/servicios/listar"
        );
        const datos = await respuesta.json();
        const catObj = {};
        if (datos.servicios) {
          datos.servicios.forEach((serv) => {
            catObj[serv.descripcion] = parseFloat(serv.precio);
          });
        }
        setCatalogo(catObj);
      } catch (error) {
        console.error("Error cargando catálogo:", error);
      }
    };
    cargarCatalogo();
  }, []);

  useEffect(() => {
    if (clientePreCargado) {
      setCliente({
        id: clientePreCargado.id || 0,
        nombre: clientePreCargado.nombre !== "null" ? clientePreCargado.nombre : "",
        atencion: clientePreCargado.atencion !== "null" ? clientePreCargado.atencion : "",
      });
    }
  }, [clientePreCargado]);

  const agregarPartida = () => {
    setPartidas([
      ...partidas,
      { id: crypto.randomUUID(), concepto: "", cantidad: 1, precio_unitario: "" }
    ]);
  };

  const eliminarPartida = (id) => {
    if (partidas.length === 1) {
      alert("Debe haber al menos una partida en la cotización.");
      return;
    }
    setPartidas(partidas.filter((p) => p.id !== id));
  };

  const actualizarPartida = (id, campo, valor) => {
    setPartidas(
      partidas.map((p) => {
        if (p.id === id) {
          const nuevaPartida = { ...p, [campo]: valor };
          if (campo === "concepto" && catalogo[valor] !== undefined) {
            nuevaPartida.precio_unitario = catalogo[valor];
          }
          return nuevaPartida;
        }
        return p;
      })
    );
  };

  const { totalParcial, iva, total } = useMemo(() => {
    const parcial = partidas.reduce((acumulador, item) => {
      const cantidad = parseFloat(String(item.cantidad).replace(",", ".")) || 0;
      const precio = parseFloat(String(item.precio_unitario).replace(",", ".")) || 0;
      return acumulador + (cantidad * precio);
    }, 0);

    const calcIva = parcial * 0.16;
    const calcTotal = parcial + calcIva;

    return { totalParcial: parcial, iva: calcIva, total: calcTotal };
  }, [partidas]);

  const generarPdfBlob = async () => {
    // 1. Activamos el modo PDF (React convierte los inputs a texto puro)
    setIsPdfMode(true);
    
    // 2. Le damos tiempo a React de pintar la pantalla (Medio segundo)
    await new Promise(resolve => setTimeout(resolve, 500));

    // 3. Tomamos el contenedor de forma segura sin referencias mutables
    const elemento = document.getElementById("documento-pdf");
    if (!elemento) {
      setIsPdfMode(false);
      return null;
    }

    const opciones = {
      margin: [0, 0, 0, 0],
      image: { type: "jpeg", quality: 0.98 },
      html2canvas: { scale: 2, useCORS: true, logging: false },
      jsPDF: { unit: "mm", format: "a4", orientation: "portrait" },
    };

    try {
      const worker = html2pdf().set(opciones).from(elemento);
      const blob = await worker.outputPdf("blob");
      // 4. Apagamos el modo PDF para que puedas seguir trabajando
      setIsPdfMode(false);
      return blob;
    } catch (error) {
      console.error("Error generando PDF:", error);
      setIsPdfMode(false);
      return null;
    }
  };

  const enviarCotizacionFinal = async () => {
    setNotificacion({ mostrar: false, tipo: "", mensaje: "" });

    const serviciosParaBackend = partidas
      .filter((p) => {
        const cant = parseFloat(String(p.cantidad).replace(",", ".")) || 0;
        const prec = parseFloat(String(p.precio_unitario).replace(",", ".")) || 0;
        return p.concepto.trim() !== "" && cant > 0 && prec > 0;
      })
      .map((p) => ({
        concepto: p.concepto.trim(),
        cantidad: parseFloat(String(p.cantidad).replace(",", ".")) || 0,
        precio_unitario: parseFloat(String(p.precio_unitario).replace(",", ".")) || 0,
      }));

    if (serviciosParaBackend.length === 0) {
      alert("Debes agregar al menos una partida válida (concepto, cantidad y precio mayor a 0).");
      return;
    }

    try {
      const respuesta = await fetchSeguro(
        "https://astonishing-determination-production.up.railway.app/api/v1/cotizaciones/generar",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            cliente: {
              id_cliente: cliente.id || 0,
              nombre: cliente.nombre || "Cliente ocasional",
              atencion: cliente.atencion || "",
            },
            servicios: serviciosParaBackend,
          }),
        }
      );

      if (respuesta.ok) {
        const data = await respuesta.json();
        
        // Bloque de generación de PDF
        const pdfBlob = await generarPdfBlob();
        if (!pdfBlob) {
          setNotificacion({ mostrar: true, tipo: "error", mensaje: "No se pudo generar el PDF." });
          return;
        }

        const formData = new FormData();
        formData.append("archivo", pdfBlob, `cotizacion_${data?.folio}.pdf`);

        const uploadRespuesta = await fetchSeguro(
          `https://astonishing-determination-production.up.railway.app/api/v1/cotizaciones/subir-pdf/${data?.folio}`,
          { method: "POST", body: formData }
        );

        if (!uploadRespuesta.ok) throw new Error("Error al subir el PDF al servidor");

        const pdfUrl = `https://astonishing-determination-production.up.railway.app/pdfs/cotizacion_${data?.folio}.pdf`;
        const enlace = document.createElement("a");
        enlace.href = pdfUrl;
        enlace.download = `cotizacion_${data?.folio}.pdf`;
        document.body.appendChild(enlace);
        enlace.click();
        document.body.removeChild(enlace);

        setNotificacion({ mostrar: true, tipo: "exito", mensaje: "¡LISTO! Cotización guardada y PDF generado." });

        setPartidas([{ id: crypto.randomUUID(), concepto: "", cantidad: 1, precio_unitario: "" }]);
        setCliente({ id: 0, nombre: "", atencion: "" });

        setTimeout(() => {
          setNotificacion({ mostrar: false, tipo: "", mensaje: "" });
        }, 5000);

      } else {
        const datosBackend = await respuesta.json();
        setNotificacion({ mostrar: true, tipo: "error", mensaje: `Error: ${datosBackend.detail || "Fallo en el servidor"}.` });
      }
    } catch (error) {
      console.error("Error en enviarCotizacionFinal:", error);
      setNotificacion({ mostrar: true, tipo: "error", mensaje: "Error de conexión con el servidor." });
    }
  };

  return (
    <div style={{ width: "100%" }}>
      {/* Usamos un ID seguro en lugar de useRef para evitar colapsos */}
      <div className="page-sim" id="documento-pdf">
        <datalist id="lista-servicios-react">
          {Object.keys(catalogo).map((desc, i) => (
            <option key={i} value={desc} />
          ))}
        </datalist>

        <div className="header-container">
          <div className="logo-box">
            <img
              src="https://astonishing-determination-production.up.railway.app/assets/logo.png"
              className="logo-img"
              alt="Logo"
              crossOrigin="anonymous"
            />
          </div>
          <div className="brand-text-box">
            <p className="brand-name">RC&C</p>
            <p className="brand-name">REFRIGERACIÓN, CLIMAS Y CONSTRUCCIÓN.</p>
            <p className="brand-address">
              Guadalupe Victoria #206-1, col. Emilio Portes Gil, Tampico.
              <br /> C.P. 89316
              <br /> Tels. 833 155 19 65
            </p>
          </div>
        </div>

        <div className="top-info-row">
          <div>
            <strong>CLIENTE:</strong>
            {!isPdfMode ? (
              <input
                type="text"
                value={cliente.nombre}
                onChange={(e) => setCliente({ ...cliente, nombre: e.target.value })}
                maxLength="65"
                placeholder="Nombre del cliente"
              />
            ) : (
              <span style={{ borderBottom: "1px solid #000", display: "inline-block", minWidth: "300px", padding: "2px" }}>
                {cliente.nombre}
              </span>
            )}
          </div>
          <div>
            <strong>FECHA:</strong> <span>{fechaActual}</span>
          </div>
        </div>

        <div className="atencion-row">
          <strong>ATENCIÓN:</strong>
          {!isPdfMode ? (
            <input
              type="text"
              value={cliente.atencion}
              onChange={(e) => setCliente({ ...cliente, atencion: e.target.value })}
              maxLength="65"
              placeholder="Persona de contacto"
            />
          ) : (
            <span style={{ borderBottom: "1px solid #000", display: "inline-block", minWidth: "400px", padding: "2px" }}>
              {cliente.atencion}
            </span>
          )}
        </div>

        <div className="intro-text">Atendiendo sus indicaciones presentamos cotización:</div>

        <table className="items-section">
          <thead>
            <tr>
              <th>PARTIDA</th>
              <th>DESCRIPCIÓN LIBRE</th>
              <th>UNIDAD</th>
              <th>CANTIDAD</th>
              <th>PRECIO U.</th>
              <th>TOTAL</th>
              {/* Ocultamos la columna del basurero en el PDF */}
              {!isPdfMode && <th></th>}
            </tr>
          </thead>
          <tbody>
            {partidas.map((p, index) => {
              const cant = parseFloat(String(p.cantidad).replace(",", ".")) || 0;
              const prec = parseFloat(String(p.precio_unitario).replace(",", ".")) || 0;
              const importeLinea = cant * prec;

              return (
                <tr key={p.id}>
                  <td style={{ textAlign: "center" }}>{index + 1}</td>
                  
                  {/* Celda de Descripción: Alterna entre Input y Texto Plano Expandible */}
                  <td className="col-desc">
                    {!isPdfMode ? (
                      <input
                        type="text"
                        className="item-input item-desc"
                        list="lista-servicios-react"
                        placeholder="Escribe o elige un concepto..."
                        value={p.concepto}
                        onChange={(e) => actualizarPartida(p.id, "concepto", e.target.value)}
                      />
                    ) : (
                      <div style={{ whiteSpace: "pre-wrap", wordBreak: "break-word", textAlign: "left", fontSize: "10pt", padding: "2px" }}>
                        {p.concepto}
                      </div>
                    )}
                  </td>
                  
                  <td>Servicio</td>
                  
                  {/* Celda Cantidad */}
                  <td>
                    {!isPdfMode ? (
                      <input
                        type="number"
                        className="item-input item-input-cant"
                        min="1"
                        step="1"
                        value={p.cantidad}
                        onChange={(e) => actualizarPartida(p.id, "cantidad", e.target.value)}
                      />
                    ) : (
                      <div style={{ textAlign: "center", fontSize: "10pt", padding: "2px" }}>{p.cantidad}</div>
                    )}
                  </td>
                  
                  {/* Celda Precio */}
                  <td>
                    {!isPdfMode ? (
                      <input
                        type="number"
                        className="item-input item-input-money"
                        min="0"
                        step="0.01"
                        value={p.precio_unitario}
                        onChange={(e) => actualizarPartida(p.id, "precio_unitario", e.target.value)}
                      />
                    ) : (
                      <div style={{ textAlign: "right", fontSize: "10pt", padding: "2px" }}>
                        ${parseFloat(p.precio_unitario || 0).toFixed(2)}
                      </div>
                    )}
                  </td>
                  
                  {/* Celda Total */}
                  <td>
                    {!isPdfMode ? (
                      <input
                        type="text"
                        className="item-input item-input-money"
                        value={importeLinea.toFixed(2)}
                        disabled
                        readOnly
                      />
                    ) : (
                      <div style={{ textAlign: "right", fontSize: "10pt", padding: "2px" }}>
                        ${importeLinea.toFixed(2)}
                      </div>
                    )}
                  </td>

                  {/* Botón Borrar: Se esconde completamente al tomar la foto */}
                  {!isPdfMode && (
                    <td>
                      <button
                        type="button"
                        className="btn-pdf"
                        onClick={() => eliminarPartida(p.id)}
                        style={{ background: "#e74c3c", padding: "4px 8px", minWidth: "30px", minHeight: "30px" }}
                      >
                        <Trash2 size={12} />
                      </button>
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>

        {/* Escondemos el botón de agregar cuando es PDF */}
        {!isPdfMode && (
          <button type="button" className="add-row-btn" onClick={agregarPartida}>
            <PlusCircle size={14} /> Añadir Partida
          </button>
        )}

        <div className="post-table-section">
          <div className="avisos">
            PRECIOS UNITARIOS + 16% DE IVA<br />
            PRECIOS EN MONEDA NACIONAL
          </div>
          <table className="totals-box">
            <tbody>
              <tr>
                <td className="label-total">TOTAL PARCIAL:</td>
                <td style={{ fontWeight: "bold", textAlign: "right" }}>${totalParcial.toFixed(2)}</td>
              </tr>
              <tr>
                <td className="label-total">IVA (16%):</td>
                <td style={{ fontWeight: "bold", textAlign: "right" }}>${iva.toFixed(2)}</td>
              </tr>
              <tr>
                <td className="label-total final-total">TOTAL:</td>
                <td className="final-total" style={{ fontWeight: "bold", textAlign: "right" }}>
                  ${total.toFixed(2)}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Botón Guardar */}
      {!isPdfMode && (
        <div className="submit-container">
          <button className="btn-submit" onClick={enviarCotizacionFinal}>
            <Save size={18} style={{ marginRight: "8px", verticalAlign: "middle" }} />
            GUARDAR COTIZACIÓN Y CREAR PDF
          </button>
          {notificacion.mostrar && (
            <div id="resultadoNotificacion" className={notificacion.tipo}>
              {notificacion.mensaje}
            </div>
          )}
        </div>
      )}
    </div>
  );
}