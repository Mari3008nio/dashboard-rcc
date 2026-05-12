import React from "react";
import { Home, FileText, Users, BookOpen } from "lucide-react";

export default function Sidebar({
  vistaActual,
  setVistaActual,
  setTituloActual,
}) {
  const navItems = [
    {
      id: "vista-inicio",
      label: "Inicio",
      icon: Home,
      titulo: "Inicio - Panel Principal",
    },
    {
      id: "vista-cotizacion",
      label: "Nueva Cotización",
      icon: FileText,
      titulo: "Nueva Cotización",
    },
    {
      id: "vista-clientes",
      label: "Clientes",
      icon: Users,
      titulo: "Directorio de Clientes",
    },
    {
      id: "vista-catalogo",
      label: "Servicios y Precios",
      icon: BookOpen,
      titulo: "Catálogo de Servicios",
    },
  ];

  return (
    <div className="sidebar">
      <div className="sidebar-header">
        <h2>RC&C</h2>
        <p>Panel de Administración</p>
      </div>
      <ul className="nav-links">
        {navItems.map((item) => (
          <li key={item.id}>
            <button
              className={vistaActual === item.id ? "active" : ""}
              onClick={() => {
                setVistaActual(item.id);
                setTituloActual(item.titulo);
              }}
            >
              <item.icon size={20} />
              {item.label}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
