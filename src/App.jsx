import React, { useState, useEffect } from "react";
import Sidebar from "./components/Sidebar";
import Topbar from "./components/Topbar";
import Inicio from "./views/Inicio";
import Cotizacion from "./views/Cotizacion";
import Clientes from "./views/Clientes";
import Catalogo from "./views/Catalogo";
import { getApiUrl } from "./config";

export default function App() {
  const [token, setToken] = useState(localStorage.getItem("rcc_token"));
  const [nombreUsuario, setNombreUsuario] = useState("Administrador");

  // Estados para el Login
  const [correo, setCorreo] = useState("");
  const [password, setPassword] = useState("");
  const [errorLogin, setErrorLogin] = useState(false);

  // Estados de navegación
  const [vistaActual, setVistaActual] = useState("vista-inicio");
  const [tituloActual, setTituloActual] = useState("Inicio - Panel Principal");

  // Datos que pasaremos de Clientes a Cotización
  const [clienteParaCotizar, setClienteParaCotizar] = useState(null);

  const intentarLogin = async () => {
    const formData = new URLSearchParams();
    formData.append("username", correo);
    formData.append("password", password);

    try {
      const response = await fetch(getApiUrl("/api/v1/login"), {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: formData,
      });

      if (response.ok) {
        const data = await response.json();
        localStorage.setItem("rcc_token", data.access_token);
        setToken(data.access_token);
        setNombreUsuario(data.nombre || "Administrador");
        setErrorLogin(false);
      } else {
        setErrorLogin(true);
      }
    } catch (error) {
      setErrorLogin(true);
    }
  };

  const cerrarSesion = () => {
    localStorage.removeItem("rcc_token");
    setToken(null);
  };

  const irACotizarCliente = (cliente) => {
    setClienteParaCotizar(cliente);
    setVistaActual("vista-cotizacion");
    setTituloActual("Nueva Cotización");
  };

  if (!token) {
    return (
      <div id="pantalla-login">
        <div className="login-box">
          <img src={getApiUrl("/assets/logo.png")} alt="Logo RC&C" />
          <h2 style={{ marginTop: 0, color: "#2c3e50" }}>Acceso al Sistema</h2>
          <input
            type="email"
            placeholder="Correo electrónico"
            value={correo}
            onChange={(e) => setCorreo(e.target.value)}
          />
          <input
            type="password"
            placeholder="Contraseña"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <button onClick={intentarLogin}>INGRESAR</button>
          {errorLogin && (
            <div id="login-error">Credenciales incorrectas o error de red.</div>
          )}
        </div>
      </div>
    );
  }

  return (
    <>
      <Sidebar
        vistaActual={vistaActual}
        setVistaActual={setVistaActual}
        setTituloActual={setTituloActual}
      />
      <div className="main-content">
        <Topbar
          titulo={tituloActual}
          nombreUsuario={nombreUsuario}
          onLogout={cerrarSesion}
        />

        {/* Renderizado condicional de vistas */}
        <div
          className={`view-container ${vistaActual === "vista-inicio" ? "active" : ""}`}
        >
          {vistaActual === "vista-inicio" && <Inicio />}
        </div>

        <div
          className={`view-container ${vistaActual === "vista-cotizacion" ? "active" : ""}`}
        >
          {vistaActual === "vista-cotizacion" && (
            <Cotizacion clientePreCargado={clienteParaCotizar} />
          )}
        </div>

        <div
          className={`view-container ${vistaActual === "vista-clientes" ? "active" : ""}`}
        >
          {vistaActual === "vista-clientes" && (
            <Clientes onCotizar={irACotizarCliente} />
          )}
        </div>

        <div
          className={`view-container ${vistaActual === "vista-catalogo" ? "active" : ""}`}
        >
          {vistaActual === "vista-catalogo" && <Catalogo />}
        </div>
      </div>
    </>
  );
}
