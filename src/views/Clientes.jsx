import React, { useState, useEffect } from "react";
import { fetchSeguro } from "../utils/api";
import { UserPlus, Edit, Trash2, Calculator } from "lucide-react";

export default function Clientes({ onCotizar }) {
  const [clientes, setClientes] = useState([]);
  const [mostrarForm, setMostrarForm] = useState(false);
  const [formDatos, setFormDatos] = useState({
    id: null,
    nombre: "",
    atencion: "",
    telefono: "",
    domicilio: "",
    rfc: "",
  });

  useEffect(() => {
    cargarDirectorio();
  }, []);

  const cargarDirectorio = async () => {
    try {
      const respuesta = await fetchSeguro(
        "http://127.0.0.1:8000/api/v1/clientes/listar",
      );
      const datos = await respuesta.json();
      setClientes(datos.clientes || []);
    } catch (error) {
      console.error(error);
    }
  };

  const abrirFormulario = (cli = null) => {
    if (cli) {
      setFormDatos({
        id: cli.id,
        nombre: cli.nombre || "",
        atencion: cli.atencion || "",
        telefono: cli.telefono || "",
        domicilio: cli.domicilio || "",
        rfc: cli.rfc || "",
      });
    } else {
      setFormDatos({
        id: null,
        nombre: "",
        atencion: "",
        telefono: "",
        domicilio: "",
        rfc: "",
      });
    }
    setMostrarForm(true);
  };

  const guardarCliente = async () => {
    if (
      !formDatos.nombre ||
      !formDatos.atencion ||
      !formDatos.telefono ||
      !formDatos.rfc ||
      !formDatos.domicilio
    ) {
      return alert("Faltan datos obligatorios.");
    }

    let url = "http://127.0.0.1:8000/api/v1/clientes/guardar";
    let method = "POST";
    let peticion = { ...formDatos, rfc: formDatos.rfc.toUpperCase() };

    if (formDatos.id) {
      url = "http://127.0.0.1:8000/api/v1/clientes/actualizar";
      method = "PUT";
      peticion.id_cliente = formDatos.id;
    }

    try {
      const respuesta = await fetchSeguro(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(peticion),
      });
      if (respuesta.ok) {
        setMostrarForm(false);
        cargarDirectorio();
      }
    } catch (error) {
      console.error(error);
    }
  };

  const borrarCliente = async (id) => {
    if (window.confirm("¿Seguro que quieres borrar este cliente?")) {
      try {
        await fetchSeguro(
          `http://127.0.0.1:8000/api/v1/clientes/borrar/${id}`,
          { method: "DELETE" },
        );
        cargarDirectorio();
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
        <h2 style={{ color: "#2c3e50", margin: 0 }}>Expediente de Clientes</h2>
        <button className="btn-action" onClick={() => abrirFormulario()}>
          <UserPlus size={16} /> Nuevo Cliente
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
            {formDatos.id ? "Editar Cliente" : "Capturar Datos del Cliente"}
          </h3>
          <div className="form-grid">
            <div className="form-group full-width">
              <label>Nombre:</label>
              <input
                type="text"
                value={formDatos.nombre}
                onChange={(e) =>
                  setFormDatos({ ...formDatos, nombre: e.target.value })
                }
                maxLength="65"
              />
            </div>
            <div className="form-group">
              <label>Atención:</label>
              <input
                type="text"
                value={formDatos.atencion}
                onChange={(e) =>
                  setFormDatos({ ...formDatos, atencion: e.target.value })
                }
                maxLength="65"
              />
            </div>
            <div className="form-group">
              <label>Teléfono:</label>
              <input
                type="text"
                value={formDatos.telefono}
                onChange={(e) =>
                  setFormDatos({ ...formDatos, telefono: e.target.value })
                }
                maxLength="10"
              />
            </div>
            <div className="form-group full-width">
              <label>Domicilio:</label>
              <input
                type="text"
                value={formDatos.domicilio}
                onChange={(e) =>
                  setFormDatos({ ...formDatos, domicilio: e.target.value })
                }
                maxLength="150"
              />
            </div>
            <div className="form-group full-width">
              <label>R.F.C.:</label>
              <input
                type="text"
                value={formDatos.rfc}
                onChange={(e) =>
                  setFormDatos({
                    ...formDatos,
                    rfc: e.target.value.toUpperCase(),
                  })
                }
                maxLength="13"
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
              onClick={guardarCliente}
              style={{ padding: "10px 20px" }}
            >
              Guardar Expediente
            </button>
          </div>
        </div>
      )}

      <table className="history-table">
        <thead>
          <tr>
            <th>Cliente</th>
            <th>Atención</th>
            <th>Teléfono</th>
            <th>R.F.C.</th>
            <th>Acciones</th>
          </tr>
        </thead>
        <tbody>
          {clientes.map((cli) => (
            <tr key={cli.id}>
              <td>
                <strong>{cli.nombre}</strong>
              </td>
              <td>{cli.atencion}</td>
              <td>{cli.telefono}</td>
              <td>{cli.rfc}</td>
              <td>
                <button className="btn-cotizar" onClick={() => onCotizar(cli)}>
                  <Calculator size={12} /> Cotizar
                </button>
                <button
                  className="btn-edit"
                  onClick={() => abrirFormulario(cli)}
                >
                  <Edit size={12} /> Editar
                </button>
                <button
                  className="btn-pdf"
                  onClick={() => borrarCliente(cli.id)}
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
