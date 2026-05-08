import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";

export function LayoutShell({ title, subtitle, children, actions = null }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  async function handleLogout() {
    await logout();
    navigate("/login", { replace: true });
  }

  return (
    <div className="app-shell">
      <header className="app-header">
        <div>
          <p className="eyebrow">Comunidad Cobros</p>
          <h1>{title}</h1>
          <p className="subtitle">{subtitle}</p>
        </div>

        <div className="header-actions">
          <div className="profile-chip">
            <strong>{user?.fullName}</strong>
            <span>{user?.role}</span>
          </div>
          {actions}
          <button className="ghost-button" onClick={handleLogout}>
            Cerrar sesión
          </button>
        </div>
      </header>

      {children}
    </div>
  );
}

