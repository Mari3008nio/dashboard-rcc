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

  const fechaActual = new Date().toLocaleDateString();

  // Inicializar con una partida vacía (solo al montar)
  useEffect(() => {
    setPartidas([{ id: Date.now(), concepto: "", cantidad: 1, precio_unitario: 0 }]);
  }, []);

  // Cargar catálogo
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
        console.error(error);
      }
    };
    cargarCatalogo();
  }, []);

  // Precargar cliente si viene del directorio
  useEffect(() => {
    if (clientePreCargado) {
      setCliente({
        id: clientePreCargado.id || 0,
        nombre: clientePreCargado.nombre !== "null" ? clientePreCargado.nombre : "",
        atencion: clientePreCargado.atencion !== "null" ? clientePreCargado.atencion : "",
      });
    }
  }, [clientePreCargado]);

  // Funciones de manejo de partidas
  const agregarPartida = () => {
    setPartidas((prev) => [
      ...prev,
      { id: Date.now(), concepto: "", cantidad: 1, precio_unitario: 0 },
    ]);
  };

  const eliminarPartida = (id) => {
    if (partidas.length === 1) {
      alert("Debe haber al menos una partida");
      return;
    }
    setPartidas((prev) => prev.filter((p) => p.id !== id));
  };

  const actualizarPartida = (id, campo, valor) => {
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
  };

  // Cálculo de totales con useMemo (depende de partidas)
  const { totalParcial, iva, total } = useMemo(() => {
    let parcial = 0;
    for (const p of partidas) {
      const cant = parseFloat(String(p.cantidad).replace(",", ".")) || 0;
      const prec = parseFloat(String(p.precio_unitario).replace(",", ".")) || 0;
      parcial += cant * prec;
    }
    const ivaCalc = parcial * 0.16;
    const totalCalc = parcial + ivaCalc;
    return { totalParcial: parcial, iva: ivaCalc, total: totalCalc };
  }, [partidas]);

  // Preparar partidas para el PDF (solo las que tienen datos)
  const partidasParaPdf = useMemo(() => {
    return partidas
      .filter(
        (p) =>
          p.concepto.trim() !== "" &&
          parseFloat(p.cantidad) > 0 &&
          parseFloat(p.precio_unitario) > 0
      )
      .map((p) => ({
        ...p,
        cantidad: parseFloat(p.cantidad),
        precio_unitario: parseFloat(p.precio_unitario),
        importe: parseFloat(p.cantidad) * parseFloat(p.precio_unitario),
      }));
  }, [partidas]);

  // Generar el blob del PDF (mismo código original)
  const generarPdfBlob = async () => {
    if (!pageRef.current) return null;

    // Truco para el PDF: convertir inputs en divs
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
      html2canvas: { scale: 2, useCORS: true, logging: false },
      jsPDF: { unit: "mm", format: "a4", orientation: "portrait" },
      pagebreak: { mode: ["css", "legacy"] },
    };

    try {
      const worker = html2pdf().set(opciones).from(pageRef.current);
      return await worker.outputPdf("blob");
    } catch (error) {
      console.error("Error generando PDF:", error);
      return null;
    } finally {
      descInputs.forEach((input) => {
        input.style.display = "";
        const div = input.parentNode.querySelector(".temp-pdf-div");
        if (div) div.remove();
      });
    }
  };

  // Enviar cotización y limpiar todo correctamente
  const enviarCotizacionFinal = async () => {
    setNotificacion({ mostrar: false, tipo: "", mensaje: "" });

    const serviciosParaBackend = partidas
      .filter(
        (p) =>
          p.concepto.trim() !== "" &&
          parseFloat(p.cantidad) > 0 &&
          parseFloat(p.precio_unitario) > 0
      )
      .map((p) => ({
        concepto: p.concepto.trim(),
        precio_unitario: parseFloat(p.precio_unitario),
        cantidad: parseFloat(p.cantidad),
      }));

    if (serviciosParaBackend.length === 0) {
      alert("Debes agregar al menos una partida con texto y precio válidos.");
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
              id_cliente: cliente.id,
              nombre: cliente.nombre,
              atencion: cliente.atencion,
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
          { method: "POST", body: formData }
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

        // ✅ RESETEO COMPLETO PARA LA PRÓXIMA COTIZACIÓN
        setPartidas([{ id: Date.now(), concepto: "", cantidad: 1, precio_unitario: 0 }]);
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
      setNotificacion({
        mostrar: true,
        tipo: "error",
        mensaje: "Error de conexión con el servidor.",
      });
    }
  };

  // Renderizado completo (igual que el original, con botón de eliminar)
  return (
    <>
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
            {partidas.map((p, idx) => {
              const importe = (parseFloat(p.cantidad) || 0) * (parseFloat(p.precio_unitario) || 0);
              return (
                <tr key={p.id}>
                  <td>{idx + 1}</td>
                  <td className="col-desc">
                    <input
                      type="text"
                      className="item-input item-desc"
                      list="lista-servicios-react"
                      placeholder="Escribe o elige un concepto..."
                      value={p.concepto}
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
                      value={p.cantidad}
                      onChange={(e) => actualizarPartida(p.id, "cantidad", e.target.value)}
                    />
                  </td>
                  <td>
                    <input
                      type="number"
                      className="item-input item-input-money"
                      value={p.precio_unitario}
                      min="0"
                      step="0.01"
                      onChange={(e) => actualizarPartida(p.id, "precio_unitario", e.target.value)}
                    />
                  </td>
                  <td>
                    <input
                      type="text"
                      className="item-input item-input-money"
                      value={importe.toFixed(2)}
                      disabled
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
    </>
  );
}