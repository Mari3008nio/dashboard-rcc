import React, { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { fetchSeguro } from "../utils/api";
import { PlusCircle, Save, Trash2 } from "lucide-react";
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
  const [resetKey, setResetKey] = useState(0);

  const fechaActual = new Date().toLocaleDateString();

  // Inicialización forzada cada vez que se resetea el componente
  useEffect(() => {
    setPartidas([{ id: Date.now() + Math.random(), concepto: "", cantidad: 1, precio_unitario: 0 }]);
    setCliente({ id: 0, nombre: "", atencion: "" });
  }, [resetKey]);

  // Cargar catálogo una sola vez
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

  // Precargar cliente solo si viene del directorio y no es el mismo
  useEffect(() => {
    if (clientePreCargado && clientePreCargado.id !== cliente.id) {
      setCliente({
        id: clientePreCargado.id || 0,
        nombre: clientePreCargado.nombre !== "null" ? clientePreCargado.nombre : "",
        atencion: clientePreCargado.atencion !== "null" ? clientePreCargado.atencion : "",
      });
    }
  }, [clientePreCargado]);

  const agregarPartida = useCallback(() => {
    setPartidas((prev) => [
      ...prev,
      { id: Date.now() + Math.random(), concepto: "", cantidad: 1, precio_unitario: 0 },
    ]);
  }, []);

  const eliminarPartida = useCallback((id) => {
    setPartidas((prev) => {
      if (prev.length === 1) {
        alert("Debe haber al menos una partida");
        return prev;
      }
      return prev.filter((p) => p.id !== id);
    });
  }, []);

  const actualizarPartida = useCallback(
    (id, campo, valor) => {
      setPartidas((prev) =>
        prev.map((p) => {
          if (p.id !== id) return p;
          let nueva = { ...p };
          if (campo === "concepto") {
            nueva.concepto = valor;
            if (catalogo[valor] !== undefined) {
              nueva.precio_unitario = catalogo[valor];
            }
          } else if (campo === "cantidad") {
            let num = parseFloat(String(valor).replace(",", "."));
            nueva.cantidad = isNaN(num) ? 0 : num;
          } else if (campo === "precio_unitario") {
            let num = parseFloat(String(valor).replace(",", "."));
            nueva.precio_unitario = isNaN(num) ? 0 : num;
          }
          return nueva;
        })
      );
    },
    [catalogo]
  );

  // Cálculo de totales – useMemo con validación completa
  const { totalParcial, iva, total } = useMemo(() => {
    let parcial = 0;
    for (const p of partidas) {
      let cant = p.cantidad;
      let prec = p.precio_unitario;
      if (typeof cant !== "number") cant = parseFloat(String(cant).replace(",", "."));
      if (typeof prec !== "number") prec = parseFloat(String(prec).replace(",", "."));
      if (isNaN(cant)) cant = 0;
      if (isNaN(prec)) prec = 0;
      parcial += cant * prec;
    }
    const ivaCalc = parcial * 0.16;
    const totalCalc = parcial + ivaCalc;
    return { totalParcial: parcial, iva: ivaCalc, total: totalCalc };
  }, [partidas]);

  // Partidas válidas para el PDF
  const partidasParaPdf = useMemo(() => {
    return partidas
      .filter(
        (p) =>
          p.concepto && p.concepto.trim() !== "" && !isNaN(p.cantidad) && !isNaN(p.precio_unitario) && p.cantidad > 0 && p.precio_unitario > 0
      )
      .map((p) => ({
        ...p,
        cantidad: Number(p.cantidad),
        precio_unitario: Number(p.precio_unitario),
        importe: Number(p.cantidad) * Number(p.precio_unitario),
      }));
  }, [partidas]);

  // Generar blob del PDF (mismo código original completo)
  const generarPdfBlob = async () => {
    if (!pageRef.current) return null;

    // --- Truco para el PDF: convertir inputs en divs
    const descInputs = pageRef.current.querySelectorAll("input.item-desc");
    descInputs.forEach((input) => {
      const div = document.createElement("div");
      div.innerText = input.value;
      div.className = "temp-pdf-div";
      div.style.whiteSpace = "pre-wrap";
      div.style.wordBreak = "break-word";
      div.style.textAlign = "left";
      div.style.fontSize = "10pt";
      input.parentNode.insertBefore(div, input);
      input.style.display = "none";
    });

    const numInputs = pageRef.current.querySelectorAll(
      "input[type='number'], input[type='text']:not(.item-desc)"
    );
    numInputs.forEach((input) => {
      input.setAttribute("value", input.value);
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
      console.error("Error generando PDF con html2pdf outputPdf:", error);
      try {
        const worker = html2pdf().set(opciones).from(pageRef.current);
        return await worker.output("blob");
      } catch (fallbackError) {
        console.error("Fallo el fallback de html2pdf:", fallbackError);
        return null;
      }
    } finally {
      // Revertir cambios
      descInputs.forEach((input) => {
        input.style.display = "";
        const div = input.parentNode.querySelector(".temp-pdf-div");
        if (div) div.remove();
      });
    }
  };

  const enviarCotizacionFinal = async () => {
    setNotificacion({ mostrar: false, tipo: "", mensaje: "" });

    const serviciosParaBackend = partidas
      .filter(
        (p) =>
          p.concepto && p.concepto.trim() !== "" &&
          !isNaN(p.cantidad) && !isNaN(p.precio_unitario) &&
          p.cantidad > 0 && p.precio_unitario > 0
      )
      .map((p) => ({
        concepto: p.concepto.trim(),
        precio_unitario: Number(p.precio_unitario),
        cantidad: Number(p.cantidad),
      }));

    if (serviciosParaBackend.length === 0) {
      alert("Debes agregar al menos una partida válida (concepto, cantidad y precio).");
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
          }
        );

        if (!uploadRespuesta.ok) {
          const textoRespuesta = await uploadRespuesta.text();
          let datosError = null;
          try {
            datosError = JSON.parse(textoRespuesta);
          } catch {
            datosError = textoRespuesta;
          }
          const detalleError = datosError
            ? typeof datosError.detail === "object"
              ? JSON.stringify(datosError.detail)
              : datosError.detail || datosError.mensaje || datosError
            : uploadRespuesta.statusText;
          setNotificacion({
            mostrar: true,
            tipo: "error",
            mensaje: `Error al guardar el PDF en el servidor: ${detalleError}`,
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

        // ✅ Resetear todo para la siguiente cotización
        setResetKey((prev) => prev + 1);

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
    <div key={resetKey} style={{ width: "100%" }}>
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
            <p className="brand-name">RC&C</p>
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
              value={cliente.nombre}
              onChange={(e) => setCliente({ ...cliente, nombre: e.target.value })}
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
            value={cliente.atencion}
            onChange={(e) => setCliente({ ...cliente, atencion: e.target.value })}
            maxLength="65"
            placeholder="Persona de contacto"
          />
        </div>

        <div className="intro-text">Atendiendo sus indicaciones presentamos cotización:</div>

        <table className="items-section">
          <thead>
            <tr>
              <th>PARTIDA</th>
              <th>DESCRIPCION LIBRE</th>
              <th>UNIDAD</th>
              <th>CANTIDAD</th>
              <th>PRECIO U.</th>
              <th>TOTAL</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {partidas.map((p, index) => {
              const cant = typeof p.cantidad === "number" ? p.cantidad : parseFloat(p.cantidad) || 0;
              const prec = typeof p.precio_unitario === "number" ? p.precio_unitario : parseFloat(p.precio_unitario) || 0;
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
                      value={p.concepto || ""}
                      onChange={(e) => actualizarPartida(p.id, "concepto", e.target.value)}
                    />
                  </td>
                  <td>Servicio</td>
                  <td>
                    <input
                      type="number"
                      className="item-input item-input-cant"
                      min="1"
                      step="1"
                      value={p.cantidad ?? 1}
                      onChange={(e) => actualizarPartida(p.id, "cantidad", e.target.value)}
                    />
                  </td>
                  <td>
                    <input
                      type="number"
                      className="item-input item-input-money"
                      value={p.precio_unitario ?? 0}
                      min="0"
                      step="0.01"
                      onChange={(e) => actualizarPartida(p.id, "precio_unitario", e.target.value)}
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
                  <td>
                    <button
                      type="button"
                      className="btn-pdf"
                      onClick={() => eliminarPartida(p.id)}
                      style={{ background: "#e74c3c", padding: "4px 8px" }}
                    >
                      <Trash2 size={12} />
                    </button>
                   </td>
                 </tr>
              );
            })}
          </tbody>
        </table>

        <button type="button" className="add-row-btn" onClick={agregarPartida}>
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

      <div className="submit-container" data-html2canvas-ignore="true">
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
    </div>
  );
}