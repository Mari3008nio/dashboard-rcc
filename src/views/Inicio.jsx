import React, { useState, useEffect } from "react";
import { fetchSeguro } from "../utils/api";
import { FileDown } from "lucide-react";

export default function Inicio() {
  const [historial, setHistorial] = useState([]);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    cargarHistorial();
  }, []);

  const cargarHistorial = async () => {
    try {
      const respuesta = await fetchSeguro(
        "https://astonishing-determination-production.up.railway.app/api/v1/cotizaciones/historial",
      );
      const datos = await respuesta.json();
      setHistorial(datos.historial || []);
    } catch (error) {
      console.error(error);
    } finally {
      setCargando(false);
    }
  };

  return (
    <>
      <div className="welcome-card">
        <h2>¡Bienvenida al Sistema!</h2>
        <p>
          Resumen de las últimas cotizaciones y PDFs generados en el sistema.
        </p>
      </div>
      <h3 style={{ color: "#2c3e50", marginBottom: "15px" }}>
        Últimos PDFs Generados
      </h3>
      <table className="history-table">
        <thead>
          <tr>
            <th>Fecha</th>
            <th>Hora</th>
            <th>Cliente</th>
            <th>Folio</th>
            <th>Acción</th>
          </tr>
        </thead>
        <tbody>
          {cargando ? (
            <tr>
              <td colSpan="5" style={{ textAlign: "center" }}>
                Cargando historial...
              </td>
            </tr>
          ) : historial.length === 0 ? (
            <tr>
              <td colSpan="5" style={{ textAlign: "center", color: "#7f8c8d" }}>
                Aún no se han generado PDFs.
              </td>
            </tr>
          ) : (
            historial.map((item, index) => (
              <tr key={index}>
                <td>{item.fecha}</td>
                <td>{item.hora}</td>
                <td>
                  <strong>{item.cliente || "Cliente no registrado"}</strong>
                </td>
                <td>{item.folio}</td>
                <td>
                  <a
                    href={item.url}
                    target="_blank"
                    rel="noreferrer"
                    className="btn-action"
                  >
                    <FileDown size={14} /> Ver PDF
                  </a>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </>
  );
}
