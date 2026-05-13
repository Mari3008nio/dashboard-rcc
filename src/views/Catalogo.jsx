import React, { useState, useEffect } from "react";
import { fetchSeguro } from "../utils/api";
import { PlusCircle, Edit, Trash2 } from "lucide-react";
import { getApiUrl } from "../config";

export default function Catalogo() {
  const [servicios, setServicios] = useState([]);
  const [mostrarForm, setMostrarForm] = useState(false);
  const [formDatos, setFormDatos] = useState({
    id: null,
    concepto: "",
    precio: "",
  });

  useEffect(() => {
    cargarCatalogo();
  }, []);

  const cargarCatalogo = async () => {
    try {
      const respuesta = await fetchSeguro(
        getApiUrl("/api/v1/servicios/listar"),
      );
      const datos = await respuesta.json();
      setServicios(datos.servicios || []);
      console.log("📋 Catálogo cargado:", datos.servicios);
    } catch (error) {
      console.error(error);
    }
  };

  const abrirFormulario = (serv = null) => {
    if (serv) {
      console.log("✏️ Editar servicio:", serv);
      setFormDatos({
        id: serv.id,
        concepto: serv.descripcion,
        precio: serv.precio, // valor numérico
      });
    } else {
      setFormDatos({ id: null, concepto: "", precio: "" });
    }
    setMostrarForm(true);
  };

  const guardarServicio = async () => {
    // Convertir a número de forma segura
    let precioNum = parseFloat(String(formDatos.precio).replace(",", "."));
    if (isNaN(precioNum)) precioNum = 0;

    console.log("💾 Guardando servicio:", {
      id: formDatos.id,
      concepto: formDatos.concepto,
      precio_unitario: precioNum,
    });

    if (!formDatos.concepto || precioNum <= 0) {
      return alert("Concepto y precio válido son requeridos.");
    }

    let url = getApiUrl("/api/v1/servicios/guardar");
    let method = "POST";
    let peticion = {
      concepto: formDatos.concepto,
      precio_unitario: precioNum,
    };

    if (formDatos.id) {
      url = getApiUrl("/api/v1/servicios/actualizar");
      method = "PUT";
      peticion.id_servicio = formDatos.id;
    }

    try {
      const respuesta = await fetchSeguro(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(peticion),
      });

      if (respuesta.ok) {
        const data = await respuesta.json();
        console.log("✅ Respuesta OK:", data);
        setMostrarForm(false);
        await cargarCatalogo(); // recarga la tabla
        alert("Servicio guardado correctamente");
      } else {
        const errorData = await respuesta.json();
        console.error("❌ Error del servidor:", errorData);
        alert("Error: " + (errorData.detail || "No se pudo guardar"));
      }
    } catch (error) {
      console.error("❌ Error de red:", error);
      alert("Error de conexión al guardar el servicio.");
    }
  };

  const borrarServicio = async (id) => {
    if (window.confirm("¿Seguro que quieres borrar este servicio?")) {
      try {
        await fetchSeguro(getApiUrl(`/api/v1/servicios/borrar/${id}`), {
          method: "DELETE",
        });
        cargarCatalogo();
      } catch (error) {
        console.error(error);
      }
    }
  };

  return (
    <>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "20px",
        }}
      >
        <h2 style={{ color: "#2c3e50", margin: 0 }}>Catálogo de Servicios</h2>
        <button className="btn-action" onClick={() => abrirFormulario()}>
          <PlusCircle size={16} /> Nuevo Servicio
        </button>
      </div>

      {mostrarForm && (
        <div className="form-card">
          <h3
            style={{
              marginTop: 0,
              color: "#3498db",
              borderBottom: "2px solid #ecf0f1",
              paddingBottom: "10px",
            }}
          >
            {formDatos.id ? "Editar Servicio" : "Añadir Servicio"}
          </h3>
          <div className="form-grid">
            <div className="form-group full-width">
              <label>Descripción:</label>
              <input
                type="text"
                value={formDatos.concepto}
                onChange={(e) =>
                  setFormDatos({ ...formDatos, concepto: e.target.value })
                }
                maxLength="100"
              />
            </div>
            <div className="form-group">
              <label>Precio Unitario:</label>
              <input
                type="number"
                step="0.01"
                value={formDatos.precio}
                onChange={(e) =>
                  setFormDatos({ ...formDatos, precio: e.target.value })
                }
                min="0"
              />
            </div>
          </div>
          <div style={{ marginTop: "20px", textAlign: "right" }}>
            <button
              className="btn-pdf"
              onClick={() => setMostrarForm(false)}
              style={{
                backgroundColor: "#95a5a6",
                padding: "10px 20px",
                marginRight: "10px",
              }}
            >
              Cancelar
            </button>
            <button
              className="btn-submit"
              onClick={guardarServicio}
              style={{ padding: "10px 20px" }}
            >
              Guardar Servicio
            </button>
          </div>
        </div>
      )}

      <table className="history-table">
        <thead>
          <tr>
            <th>ID</th>
            <th>Descripción</th>
            <th>Precio Unitario</th>
            <th>Acciones</th>
          </tr>
        </thead>
        <tbody>
          {servicios.map((serv) => (
            <tr key={serv.id}>
              <td>{serv.id}</td>
              <td>
                <strong>{serv.descripcion}</strong>
              </td>
              <td>${Number(serv.precio).toFixed(2)}</td>
              <td>
                <button
                  className="btn-edit"
                  onClick={() => abrirFormulario(serv)}
                >
                  <Edit size={12} /> Editar
                </button>
                <button
                  className="btn-pdf"
                  onClick={() => borrarServicio(serv.id)}
                >
                  <Trash2 size={12} /> Borrar
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}
