import React from "react";
import { LogOut, User } from "lucide-react";

export default function Topbar({ titulo, nombreUsuario, onLogout }) {
  return (
    <div className="topbar">
      <h3>{titulo}</h3>
      <div className="user-info">
        <User size={18} />
        <span>Hola, {nombreUsuario}</span>
        <button className="btn-logout" onClick={onLogout}>
          <LogOut size={14} /> Cerrar Sesión
        </button>
      </div>
    </div>
  );
}
