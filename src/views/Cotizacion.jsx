import React, { useState, useEffect, useMemo, useRef } from "react";
import { fetchSeguro } from "../utils/api";
import { PlusCircle, Save, Trash2 } from "lucide-react";
import html2pdf from "html2pdf.js";
import { getApiUrl } from "../config";

const generarId = () =>
  Date.now().toString(36) + Math.random().toString(36).substring(2);

export default function Cotizacion({ clientePreCargado }) {
  const pageRef = useRef(null);
  const [cliente, setCliente] = useState({ id: 0, nombre: "", atencion: "" });

  const [partidas, setPartidas] = useState([
    { id: generarId(), concepto: "", cantidad: 1, precio_unitario: "" },
  ]);

  const [catalogo, setCatalogo] = useState({});
  const [notificacion, setNotificacion] = useState({
    mostrar: false,
    tipo: "",
    mensaje: "",
  });

  const fechaActual = new Date().toLocaleDateString();

  useEffect(() => {
    const cargarCatalogo = async () => {
      try {
        const respuesta = await fetchSeguro(
          getApiUrl("/api/v1/servicios/listar"),
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
        nombre:
          clientePreCargado.nombre !== "null" ? clientePreCargado.nombre : "",
        atencion:
          clientePreCargado.atencion !== "null"
            ? clientePreCargado.atencion
            : "",
      });
    }
  }, [clientePreCargado]);

  const agregarPartida = () => {
    setPartidas([
      ...partidas,
      { id: generarId(), concepto: "", cantidad: 1, precio_unitario: "" },
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
    setPartidas((prev) =>
      prev.map((p) => {
        if (p.id === id) {
          const nuevaPartida = { ...p, [campo]: valor };
          if (campo === "concepto" && catalogo[valor] !== undefined) {
            nuevaPartida.precio_unitario = catalogo[valor];
          }
          return nuevaPartida;
        }
        return p;
      }),
    );
  };

  const { totalParcial, iva, total } = useMemo(() => {
    let parcial = 0;
    partidas.forEach((item) => {
      const cantidad = Number(item.cantidad) || 0;
      const precio = Number(item.precio_unitario) || 0;
      parcial += cantidad * precio;
    });
    const calcIva = parcial * 0.16;
    const calcTotal = parcial + calcIva;
    return { totalParcial: parcial, iva: calcIva, total: calcTotal };
  }, [partidas]);

  const generarPdfBlob = async () => {
    if (!pageRef.current) return null;

    // ─── PASO 1: Reemplazar inputs en el DOM real ───────────────────────────
    // html2canvas calcula el layout ANTES de onclone, así que hay que modificar
    // el DOM verdadero. Guardamos los inputs para restaurarlos después.
    const reemplazos = [];
    const inputs = Array.from(pageRef.current.querySelectorAll("input"));

    inputs.forEach((input) => {
      const computed = window.getComputedStyle(input);
      const span = document.createElement("span");
      span.textContent = input.value || "";
      span.style.fontFamily = computed.fontFamily;
      span.style.fontSize = computed.fontSize;
      span.style.color = "#000";
      span.style.background = "transparent";
      span.style.border = "none";
      span.style.boxSizing = "border-box";
      span.style.lineHeight = "1.6";

      if (input.classList.contains("item-desc")) {
        span.style.display = "block";
        span.style.width = "100%";
        span.style.whiteSpace = "pre-wrap";
        span.style.wordBreak = "break-word";
        span.style.textAlign = "left";
        span.style.padding = "2px";
      } else if (input.classList.contains("item-input-money")) {
        span.style.display = "block";
        span.style.width = "100%";
        span.style.textAlign = "right";
        span.style.padding = "2px 0";
      } else if (input.classList.contains("item-input-cant")) {
        span.style.display = "block";
        span.style.width = "100%";
        span.style.textAlign = "center";
        span.style.padding = "2px 0";
      } else {
        // Nombre del cliente y atención
        span.style.display = "inline-block";
        span.style.fontSize = "11pt";
        span.style.borderBottom = "1px solid #000";
        span.style.paddingBottom = "5px";
        span.style.paddingTop = "2px";
        span.style.width = computed.width;
      }

      input.parentNode.replaceChild(span, input);
      reemplazos.push({ span, input });
    });

    // ─── PASO 2: Capturar el PDF ────────────────────────────────────────────
    const mainContent = document.querySelector(".main-content");
    const scrollOffset = mainContent ? mainContent.scrollTop : 0;

    const opciones = {
      margin: [0, 0, 0, 0],
      image: { type: "jpeg", quality: 0.98 },
      html2canvas: {
        scale: 2,
        useCORS: true,
        logging: false,
        scrollX: 0,
        scrollY: -scrollOffset,
        windowHeight: pageRef.current.scrollHeight + 200,
      },
      jsPDF: { unit: "mm", format: "a4", orientation: "portrait" },
    };

    let blob = null;
    try {
      const worker = html2pdf().set(opciones).from(pageRef.current);
      blob = await worker.outputPdf("blob");
    } catch (error) {
      console.error("Error generando PDF:", error);
    } finally {
      // ─── PASO 3: Restaurar los inputs originales ──────────────────────────
      // Siempre restauramos, aunque haya fallado la captura
      reemplazos.forEach(({ span, input }) => {
        if (span.parentNode) {
          span.parentNode.replaceChild(input, span);
        }
      });
    }

    return blob;
  };

  const enviarCotizacionFinal = async () => {
    setNotificacion({ mostrar: false, tipo: "", mensaje: "" });

    const serviciosParaBackend = partidas
      .filter((p) => {
        const cant = Number(p.cantidad) || 0;
        const prec = Number(p.precio_unitario) || 0;
        return p.concepto.trim() !== "" && cant > 0 && prec > 0;
      })
      .map((p) => ({
        concepto: p.concepto.trim(),
        cantidad: Number(p.cantidad) || 0,
        precio_unitario: Number(p.precio_unitario) || 0,
      }));

    if (serviciosParaBackend.length === 0) {
      alert(
        "Debes agregar al menos una partida válida (concepto, cantidad y precio mayor a 0).",
      );
      return;
    }

    try {
      const respuesta = await fetchSeguro(
        getApiUrl("/api/v1/cotizaciones/generar"),
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
        },
      );

      if (respuesta.ok) {
        const data = await respuesta.json();
        const pdfBlob = await generarPdfBlob();

        if (!pdfBlob) {
          setNotificacion({
            mostrar: true,
            tipo: "error",
            mensaje: "No se pudo generar el PDF.",
          });
          return;
        }

        const formData = new FormData();
        formData.append("archivo", pdfBlob, `cotizacion_${data?.folio}.pdf`);

        const uploadRespuesta = await fetchSeguro(
          getApiUrl(`/api/v1/cotizaciones/subir-pdf/${data?.folio}`),
          { method: "POST", body: formData },
        );

        if (!uploadRespuesta.ok)
          throw new Error("Error al subir el PDF al servidor");

        const pdfUrl = getApiUrl(`/pdfs/cotizacion_${data?.folio}.pdf`);
        const enlace = document.createElement("a");
        enlace.href = pdfUrl;
        enlace.download = `cotizacion_${data?.folio}.pdf`;
        document.body.appendChild(enlace);
        enlace.click();
        document.body.removeChild(enlace);

        setNotificacion({
          mostrar: true,
          tipo: "exito",
          mensaje: "¡LISTO! Cotización guardada y PDF generado.",
        });

        setPartidas([
          { id: generarId(), concepto: "", cantidad: 1, precio_unitario: "" },
        ]);
        setCliente({ id: 0, nombre: "", atencion: "" });

        setTimeout(() => {
          setNotificacion({ mostrar: false, tipo: "", mensaje: "" });
        }, 5000);
      } else {
        const datosBackend = await respuesta.json();
        setNotificacion({
          mostrar: true,
          tipo: "error",
          mensaje: `Error: ${datosBackend.detail || "Fallo en el servidor"}.`,
        });
      }
    } catch (error) {
      console.error("Error en enviarCotizacionFinal:", error);
      setNotificacion({
        mostrar: true,
        tipo: "error",
        mensaje: "Error de conexión con el servidor.",
      });
    }
  };

  return (
    <div style={{ width: "100%" }}>
      <div className="page-sim" ref={pageRef}>
        <datalist id="lista-servicios-react">
          {Object.keys(catalogo).map((desc, i) => (
            <option key={i} value={desc} />
          ))}
        </datalist>

        <div className="header-container">
          <div className="logo-box">
            <img
              src={getApiUrl("/assets/logo_nuevo.png")}
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
            <input
              type="text"
              value={cliente.nombre}
              onChange={(e) =>
                setCliente({ ...cliente, nombre: e.target.value })
              }
              maxLength="65"
              placeholder="Nombre del cliente"
            />
          </div>
          <div>
            <strong>FECHA:</strong> <span>{fechaActual}</span>
          </div>
        </div>

        <div className="atencion-row">
          <strong>ATENCIÓN:</strong>
          <input
            type="text"
            value={cliente.atencion}
            onChange={(e) =>
              setCliente({ ...cliente, atencion: e.target.value })
            }
            maxLength="65"
            placeholder="Persona de contacto"
          />
        </div>

        <div className="intro-text">
          Atendiendo sus indicaciones presentamos cotización:
        </div>

        <table className="items-section">
          <thead>
            <tr>
              <th>PARTIDA</th>
              <th>DESCRIPCIÓN LIBRE</th>
              <th>UNIDAD</th>
              <th>CANTIDAD</th>
              <th>PRECIO U.</th>
              <th>TOTAL</th>
              <th data-html2canvas-ignore="true"></th>
            </tr>
          </thead>
          <tbody>
            {partidas.map((p, index) => {
              const cant = Number(p.cantidad) || 0;
              const prec = Number(p.precio_unitario) || 0;
              const importeLinea = cant * prec;

              return (
                <tr key={p.id}>
                  <td style={{ textAlign: "center" }}>{index + 1}</td>
                  <td className="col-desc">
                    <input
                      type="text"
                      className="item-input item-desc"
                      list="lista-servicios-react"
                      placeholder="Escribe o elige un concepto..."
                      value={p.concepto}
                      onChange={(e) =>
                        actualizarPartida(p.id, "concepto", e.target.value)
                      }
                    />
                  </td>
                  <td>Servicio</td>
                  <td>
                    <input
                      type="number"
                      className="item-input item-input-cant"
                      min="1"
                      step="1"
                      value={p.cantidad}
                      onChange={(e) =>
                        actualizarPartida(p.id, "cantidad", e.target.value)
                      }
                    />
                  </td>
                  <td>
                    <input
                      type="number"
                      className="item-input item-input-money"
                      min="0"
                      step="0.01"
                      value={p.precio_unitario}
                      onChange={(e) =>
                        actualizarPartida(
                          p.id,
                          "precio_unitario",
                          e.target.value,
                        )
                      }
                    />
                  </td>
                  <td>
                    <input
                      type="text"
                      className="item-input item-input-money"
                      value={importeLinea.toFixed(2)}
                      disabled
                      readOnly
                    />
                  </td>
                  <td data-html2canvas-ignore="true">
                    <button
                      type="button"
                      className="btn-pdf"
                      onClick={() => eliminarPartida(p.id)}
                      style={{
                        background: "#e74c3c",
                        padding: "4px 8px",
                        minWidth: "30px",
                        minHeight: "30px",
                      }}
                    >
                      <Trash2 size={12} />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        <button
          type="button"
          className="add-row-btn"
          onClick={agregarPartida}
          data-html2canvas-ignore="true"
        >
          <PlusCircle size={14} /> Añadir Partida
        </button>

        <div className="post-table-section">
          <div className="avisos">
            PRECIOS UNITARIOS + 16% DE IVA
            <br />
            PRECIOS EN MONEDA NACIONAL
          </div>
          <table className="totals-box">
            <tbody>
              <tr>
                <td className="label-total">TOTAL PARCIAL:</td>
                <td style={{ fontWeight: "bold", textAlign: "right" }}>
                  ${totalParcial.toFixed(2)}
                </td>
              </tr>
              <tr>
                <td className="label-total">IVA (16%):</td>
                <td style={{ fontWeight: "bold", textAlign: "right" }}>
                  ${iva.toFixed(2)}
                </td>
              </tr>
              <tr>
                <td className="label-total final-total">TOTAL:</td>
                <td
                  className="final-total"
                  style={{ fontWeight: "bold", textAlign: "right" }}
                >
                  ${total.toFixed(2)}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <div className="submit-container" data-html2canvas-ignore="true">
        <button className="btn-submit" onClick={enviarCotizacionFinal}>
          <Save
            size={18}
            style={{ marginRight: "8px", verticalAlign: "middle" }}
          />
          GUARDAR COTIZACIÓN Y CREAR PDF
        </button>
        {notificacion.mostrar && (
          <div id="resultadoNotificacion" className={notificacion.tipo}>
            {notificacion.mensaje}
          </div>
        )}
      </div>
    </div>
  );
}
