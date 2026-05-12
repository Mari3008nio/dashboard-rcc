import React, { useState, useEffect, useMemo, useRef } from "react";
import { fetchSeguro } from "../utils/api";
import { PlusCircle, Save } from "lucide-react";
import html2pdf from "html2pdf.js";

export default function Cotizacion({ clientePreCargado }) {
  const pageRef = useRef(null);
  const [cliente, setCliente] = useState({ id: 0, nombre: "", atencion: "" });
  const [partidas, setPartidas] = useState([
    { id: Date.now(), concepto: "", cantidad: 1, precio_unitario: 0 },
  ]);
  const [catalogo, setCatalogo] = useState({});
  const [notificacion, setNotificacion] = useState({
    mostrar: false,
    tipo: "",
    mensaje: "",
  });

  const fechaActual = new Date().toLocaleDateString();

  useEffect(() => {
    cargarCatalogo();
  }, []);

  useEffect(() => {
    if (clientePreCargado) {
      setCliente({
        id: clientePreCargado.id,
        nombre:
          clientePreCargado.nombre !== "null" ? clientePreCargado.nombre : "",
        atencion:
          clientePreCargado.atencion !== "null"
            ? clientePreCargado.atencion
            : "",
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

  const agregarPartida = () => {
    setPartidas([
      ...partidas,
      { id: Date.now(), concepto: "", cantidad: 1, precio_unitario: 0 },
    ]);
  };

  const actualizarPartida = (id, campo, valor) => {
    setPartidas(
      partidas.map((p) => {
        if (p.id === id) {
          let valorProcesado = valor;

          if (campo === "cantidad" || campo === "precio_unitario") {
            const texto = String(valor).replace(",", ".");
            valorProcesado = texto === "" ? 0 : Number(texto);
          }

          const nuevaPartida = { ...p, [campo]: valorProcesado };
          // Autocompletar precio si existe en catálogo y se está editando el concepto
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
    const parcial = partidas.reduce((acumulador, item) => {
      const cantidad = Number(String(item.cantidad).replace(",", ".")) || 0;
      const precio = Number(String(item.precio_unitario).replace(",", ".")) || 0;
      return acumulador + cantidad * precio;
    }, 0);

    const calcIva = parcial * 0.16;
    const calcTotal = parcial + calcIva;

    return { totalParcial: parcial, iva: calcIva, total: calcTotal };
  }, [partidas]);

  const partidasParaPdf = useMemo(
    () =>
      partidas
        .filter(
          (p) =>
            p.concepto.trim() !== "" &&
            Number(p.cantidad) > 0 &&
            !isNaN(Number(p.precio_unitario)),
        )
        .map((p) => ({
          ...p,
          cantidad: Number(String(p.cantidad).replace(",", ".")) || 0,
          precio_unitario: Number(String(p.precio_unitario).replace(",", ".")) || 0,
          importe:
            (Number(String(p.cantidad).replace(",", ".")) || 0) *
            (Number(String(p.precio_unitario).replace(",", ".")) || 0),
        })),
    [partidas],
  );

  const generarPdfBlob = async () => {
    if (!pageRef.current) return null;

    // --- TRUCO NIVEL DIOS PARA EL PDF ---
    // 1. Convertimos el input de texto en un <div> temporal para que el PDF baje de renglón
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
      input.style.display = "none"; // Ocultamos el input original
    });

    // 2. Fijamos el valor de los números para que no salgan en blanco
    const numInputs = pageRef.current.querySelectorAll(
      "input[type='number'], input[type='text']:not(.item-desc)",
    );
    numInputs.forEach((input) => {
      input.setAttribute("value", input.value);
    });
    // ------------------------------------

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
      // --- REVERTIMOS EL TRUCO PARA QUE LA PANTALLA NO SE ROMPA ---
      descInputs.forEach((input) => {
        input.style.display = ""; // Volvemos a mostrar el input
        const div = input.parentNode.querySelector(".temp-pdf-div");
        if (div) div.remove(); // Borramos el texto temporal
      });
    }
  };

  const enviarCotizacionFinal = async () => {
    setNotificacion({ mostrar: false, tipo: "", mensaje: "" });

    const serviciosParaBackend = partidas
      .filter(
        (p) =>
          p.concepto.trim() !== "" &&
          p.cantidad > 0 &&
          !isNaN(p.precio_unitario),
      )
      .map((p) => ({
        concepto: p.concepto.trim(),
        precio_unitario: parseFloat(String(p.precio_unitario).replace(",", ".")) || 0,
        cantidad: parseFloat(String(p.cantidad).replace(",", ".")) || 0,
      }));

    if (serviciosParaBackend.length === 0) {
      alert(
        "Debes agregar al menos una partida con texto y precio a la tabla.",
      );
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

        const uploadData = await uploadRespuesta.json();
        const pdfUrl =
          uploadData.url ||
          `https://astonishing-determination-production.up.railway.app/pdfs/cotizacion_${data?.folio}.pdf`;

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
        // Limpiar form
        setPartidas([
          { id: Date.now(), concepto: "", cantidad: 1, precio_unitario: 0 },
        ]);
        setCliente({ id: 0, nombre: "", atencion: "" });
      } else {
        const datosBackend = await respuesta.json();
        setNotificacion({
          mostrar: true,
          tipo: "error",
          mensaje: `Error: ${datosBackend.detail || "Fallo"}.`,
        });
      }
    } catch (error) {
      setNotificacion({
        mostrar: true,
        tipo: "error",
        mensaje: "Error de conexión.",
      });
    }
  };

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
              onChange={(e) =>
                setCliente({ ...cliente, nombre: e.target.value })
              }
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
            onChange={(e) =>
              setCliente({ ...cliente, atencion: e.target.value })
            }
            maxLength="65"
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
            {partidas.map((p, index) => (
              <tr key={p.id}>
                <td>{index + 1}</td>
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
                    value={p.precio_unitario}
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
                    value={(
                      (parseFloat(String(p.cantidad).replace(",", ".")) || 0) *
                      (parseFloat(String(p.precio_unitario).replace(",", ".")) || 0)
                    ).toFixed(2)}
                    disabled
                  />
                </td>
              </tr>
            ))}
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
    </>
  );
}