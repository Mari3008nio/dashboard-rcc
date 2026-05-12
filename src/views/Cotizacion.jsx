import React, { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { fetchSeguro } from "../utils/api";
import { PlusCircle, Save } from "lucide-react";
import html2pdf from "html2pdf.js";

export default function Cotizacion({ clientePreCargado }) {
  const pageRef = useRef(null);
  const [cliente, setCliente] = useState({ id: 0, nombre: "", atencion: "" });
  const [partidas, setPartidas] = useState([]);
  const [catalogo, setCatalogo] = useState({});
  const [notificacion, setNotificacion] = useState({
    mostrar: false,
    tipo: "",
    mensaje: "",
  });
  const [resetKey, setResetKey] = useState(0); // 🔑 Forzar reset del componente

  const fechaActual = new Date().toLocaleDateString();

  // Inicializar con una partida vacía SOLO cuando el componente se monta o se resetea
  useEffect(() => {
    setPartidas([
      { id: Date.now() + Math.random(), concepto: "", cantidad: 1, precio_unitario: 0, importe: 0 },
    ]);
  }, [resetKey]);

  useEffect(() => {
    cargarCatalogo();
  }, []);

  useEffect(() => {
    if (clientePreCargado && clientePreCargado.id !== cliente.id) {
      setCliente({
        id: clientePreCargado.id || 0,
        nombre: clientePreCargado.nombre && clientePreCargado.nombre !== "null" ? clientePreCargado.nombre : "",
        atencion: clientePreCargado.atencion && clientePreCargado.atencion !== "null" ? clientePreCargado.atencion : "",
      });
    }
  }, [clientePreCargado]);

  const cargarCatalogo = async () => {
    try {
      const respuesta = await fetchSeguro(
        "https://astonishing-determination-production.up.railway.app/api/v1/servicios/listar",
      );
      const datos = await respuesta.json();
      const catObj = {};
      if (datos.servicios && Array.isArray(datos.servicios)) {
        datos.servicios.forEach((serv) => {
          if (serv.descripcion && serv.precio) {
            catObj[serv.descripcion] = parseFloat(serv.precio);
          }
        });
      }
      setCatalogo(catObj);
    } catch (error) {
      console.error("Error cargando catálogo:", error);
    }
  };

  const agregarPartida = () => {
    setPartidas((prevPartidas) => [
      ...prevPartidas,
      { id: Date.now() + Math.random(), concepto: "", cantidad: 1, precio_unitario: 0, importe: 0 },
    ]);
  };

  const actualizarPartida = useCallback((id, campo, valor) => {
    setPartidas((prevPartidas) =>
      prevPartidas.map((p) => {
        if (p.id !== id) return p;
        
        let nuevaPartida = { ...p };
        
        if (campo === "concepto") {
          nuevaPartida.concepto = valor;
          if (catalogo[valor] !== undefined && catalogo[valor] > 0) {
            nuevaPartida.precio_unitario = catalogo[valor];
          }
        } 
        else if (campo === "cantidad") {
          let num = parseFloat(String(valor).replace(",", "."));
          nuevaPartida.cantidad = isNaN(num) ? 1 : num;
        }
        else if (campo === "precio_unitario") {
          let num = parseFloat(String(valor).replace(",", "."));
          nuevaPartida.precio_unitario = isNaN(num) ? 0 : num;
        }
        
        // Recalcular importe
        nuevaPartida.importe = (nuevaPartida.cantidad || 0) * (nuevaPartida.precio_unitario || 0);
        
        return nuevaPartida;
      }),
    );
  }, [catalogo]);

  // Calcular totales - versión simple y directa
  const totales = useMemo(() => {
    let parcial = 0;
    
    for (const p of partidas) {
      const cant = typeof p.cantidad === 'number' ? p.cantidad : parseFloat(p.cantidad || 0);
      const prec = typeof p.precio_unitario === 'number' ? p.precio_unitario : parseFloat(p.precio_unitario || 0);
      const importe = (isNaN(cant) ? 0 : cant) * (isNaN(prec) ? 0 : prec);
      parcial += importe;
    }
    
    const iva = parcial * 0.16;
    const total = parcial + iva;
    
    return { totalParcial: parcial, iva, total };
  }, [partidas]);

  const limpiarFormulario = useCallback(() => {
    // Forzar reset del componente generando una nueva key
    setResetKey(prev => prev + 1);
    setCliente({ id: 0, nombre: "", atencion: "" });
  }, []);

  const generarPdfBlob = async () => {
    if (!pageRef.current) return null;

    const descInputs = pageRef.current.querySelectorAll("input.item-desc");
    const inputsModificados = [];
    
    descInputs.forEach((input) => {
      const div = document.createElement("div");
      div.innerText = input.value || "";
      div.className = "temp-pdf-div";
      div.style.whiteSpace = "pre-wrap";
      div.style.wordBreak = "break-word";
      div.style.textAlign = "left";
      div.style.fontSize = "10pt";
      input.parentNode.insertBefore(div, input);
      input.style.display = "none";
      inputsModificados.push(input);
    });

    const numInputs = pageRef.current.querySelectorAll(
      "input[type='number'], input[type='text']:not(.item-desc)",
    );
    numInputs.forEach((input) => {
      input.setAttribute("value", input.value || "");
    });

    const opciones = {
      margin: [0, 0, 0, 0],
      image: { type: "jpeg", quality: 0.98 },
      html2canvas: {
        scale: 2,
        useCORS: true,
        logging: false,
      },
      jsPDF: {
        unit: "mm",
        format: "a4",
        orientation: "portrait",
      },
      pagebreak: { mode: ["css", "legacy"] },
    };

    try {
      const worker = html2pdf().set(opciones).from(pageRef.current);
      return await worker.outputPdf("blob");
    } catch (error) {
      console.error("Error generando PDF:", error);
      return null;
    } finally {
      inputsModificados.forEach((input) => {
        input.style.display = "";
        const div = input.parentNode.querySelector(".temp-pdf-div");
        if (div) div.remove();
      });
    }
  };

  const enviarCotizacionFinal = async () => {
    setNotificacion({ mostrar: false, tipo: "", mensaje: "" });

    // Validar partidas
    const serviciosParaBackend = [];
    
    for (const p of partidas) {
      const concepto = p.concepto ? p.concepto.trim() : "";
      const cantidad = parseFloat(String(p.cantidad || 0).replace(",", "."));
      const precio = parseFloat(String(p.precio_unitario || 0).replace(",", "."));
      
      if (concepto !== "" && cantidad > 0 && precio > 0) {
        serviciosParaBackend.push({
          concepto: concepto,
          precio_unitario: precio,
          cantidad: cantidad,
        });
      }
    }

    if (serviciosParaBackend.length === 0) {
      alert("Debes agregar al menos una partida con concepto, cantidad y precio válidos.");
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
        },
      );

      if (respuesta.ok) {
        const data = await respuesta.json();
        const pdfBlob = await generarPdfBlob();

        if (!pdfBlob) {
          setNotificacion({
            mostrar: true,
            tipo: "error",
            mensaje: "No se pudo generar el PDF en el navegador.",
          });
          return;
        }

        const formData = new FormData();
        formData.append("archivo", pdfBlob, `cotizacion_${data?.folio}.pdf`);

        const uploadRespuesta = await fetchSeguro(
          `https://astonishing-determination-production.up.railway.app/api/v1/cotizaciones/subir-pdf/${data?.folio}`,
          {
            method: "POST",
            body: formData,
          },
        );

        if (!uploadRespuesta.ok) {
          setNotificacion({
            mostrar: true,
            tipo: "error",
            mensaje: "Error al guardar el PDF en el servidor.",
          });
          return;
        }

        const pdfUrl = `https://astonishing-determination-production.up.railway.app/pdfs/cotizacion_${data?.folio}.pdf`;
        
        const enlace = document.createElement("a");
        enlace.href = pdfUrl;
        enlace.download = `cotizacion_${data?.folio}.pdf`;
        document.body.appendChild(enlace);
        enlace.click();
        document.body.removeChild(enlace);

        setNotificacion({
          mostrar: true,
          tipo: "exito",
          mensaje: "¡LISTO! Cotización guardada y PDF descargado.",
        });
        
        // ✅ LIMPIAR FORMULARIO COMPLETAMENTE
        limpiarFormulario();
        
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
      console.error("Error:", error);
      setNotificacion({
        mostrar: true,
        tipo: "error",
        mensaje: "Error de conexión con el servidor.",
      });
    }
  };

  return (
    <div key={resetKey}> {/* 🔑 Forzar rerender completo al resetear */}
      <div className="page-sim" ref={pageRef}>
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
            <p className="brand-name">RC&amp;C</p>
            <p className="brand-name">REFRIGERACIÓN, CLIMAS Y CONSTRUCCIÓN.</p>
            <p className="brand-address">
              Guadalupe Victoria #206-1, col. Emilio Portes Gil, Tampico.
              <br />
              C.P. 89316
              <br />
              Tels. 833 155 19 65
            </p>
          </div>
        </div>

        <div className="top-info-row">
          <div>
            <strong>CLIENTE:</strong>
            <input
              type="text"
              value={cliente.nombre || ""}
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
          <strong>ATENCION:</strong>
          <input
            type="text"
            value={cliente.atencion || ""}
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
              <th>DESCRIPCION LIBRE</th>
              <th>UNIDAD</th>
              <th>CANTIDAD</th>
              <th>PRECIO U.</th>
              <th>TOTAL</th>
            </tr>
          </thead>
          <tbody>
            {partidas.map((p, index) => {
              const importeLinea = (p.cantidad || 0) * (p.precio_unitario || 0);
              return (
                <tr key={p.id}>
                  <td style={{ textAlign: "center" }}>{index + 1}</td>
                  <td className="col-desc">
                    <input
                      type="text"
                      className="item-input item-desc"
                      list="lista-servicios-react"
                      placeholder="Escribe o elige un concepto..."
                      value={p.concepto || ""}
                      onChange={(e) =>
                        actualizarPartida(p.id, "concepto", e.target.value)
                      }
                    />
                  </td>
                  <td style={{ textAlign: "center" }}>Servicio</td>
                  <td>
                    <input
                      type="number"
                      className="item-input item-input-cant"
                      min="1"
                      step="1"
                      value={p.cantidad ?? 1}
                      onChange={(e) =>
                        actualizarPartida(p.id, "cantidad", e.target.value)
                      }
                    />
                  </td>
                  <td>
                    <input
                      type="number"
                      className="item-input item-input-money"
                      value={p.precio_unitario ?? 0}
                      min="0"
                      step="0.01"
                      onChange={(e) =>
                        actualizarPartida(p.id, "precio_unitario", e.target.value)
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
                  ${totales.totalParcial.toFixed(2)}
                </td>
              </tr>
              <tr>
                <td className="label-total">IVA (16%):</td>
                <td style={{ fontWeight: "bold", textAlign: "right" }}>
                  ${totales.iva.toFixed(2)}
                </td>
              </tr>
              <tr>
                <td className="label-total final-total">TOTAL:</td>
                <td
                  className="final-total"
                  style={{ fontWeight: "bold", textAlign: "right" }}
                >
                  ${totales.total.toFixed(2)}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <div className="submit-container" data-html2canvas-ignore="true">
        <button
          className="btn-submit"
          onClick={enviarCotizacionFinal}
          data-html2canvas-ignore="true"
        >
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