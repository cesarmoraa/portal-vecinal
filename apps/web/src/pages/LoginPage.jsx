import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";

export function LoginPage() {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [mode, setMode] = useState("vecino");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [neighborForm, setNeighborForm] = useState({
    pasaje: "",
    numeracion: "",
    pin: "",
  });
  const [staffForm, setStaffForm] = useState({
    role: "admin",
    username: "",
    password: "",
  });

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    setLoading(true);

    try {
      const user =
        mode === "vecino"
          ? await login({ role: "vecino", ...neighborForm })
          : await login({ role: staffForm.role, ...staffForm });

      if (user.mustChangePassword) {
        navigate("/cambiar-pin", { replace: true });
      } else if (user.role === "vecino") {
        navigate("/vecino", { replace: true });
      } else if (user.role === "tesorero") {
        navigate("/tesorero", { replace: true });
      } else {
        navigate("/admin", { replace: true });
      }
    } catch (submitError) {
      setError(submitError.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="login-shell">
      <section className="login-hero">
        <p className="eyebrow">Plataforma Vecinal Segura</p>
        <h1>Gestión profesional de pagos, deuda y mapa comunitario.</h1>
        <p>
          El mapa es el centro operativo, pero la lógica crítica vive en backend:
          autenticación, auditoría, cuotas equivalentes y estado financiero.
        </p>
      </section>

      <section className="login-card">
        <div className="toggle-row">
          <button
            className={mode === "vecino" ? "toggle-pill active" : "toggle-pill"}
            onClick={() => setMode("vecino")}
            type="button"
          >
            Acceso vecino
          </button>
          <button
            className={mode === "staff" ? "toggle-pill active" : "toggle-pill"}
            onClick={() => setMode("staff")}
            type="button"
          >
            Admin / tesorero
          </button>
        </div>

        <form className="stack-form" onSubmit={handleSubmit}>
          {mode === "vecino" ? (
            <>
              <label>
                <span>Pasaje</span>
                <input
                  value={neighborForm.pasaje}
                  onChange={(event) =>
                    setNeighborForm((current) => ({ ...current, pasaje: event.target.value }))
                  }
                  placeholder="EL HUERTO"
                  required
                />
              </label>
              <label>
                <span>Numeración</span>
                <input
                  value={neighborForm.numeracion}
                  onChange={(event) =>
                    setNeighborForm((current) => ({
                      ...current,
                      numeracion: event.target.value,
                    }))
                  }
                  placeholder="3656"
                  required
                />
              </label>
              <label>
                <span>PIN de 4 dígitos</span>
                <input
                  value={neighborForm.pin}
                  onChange={(event) =>
                    setNeighborForm((current) => ({ ...current, pin: event.target.value }))
                  }
                  inputMode="numeric"
                  maxLength={4}
                  placeholder="4321"
                  required
                />
              </label>
              <p className="subtitle">
                PIN inicial: últimos 4 dígitos del teléfono registrado en la comunidad.
              </p>
            </>
          ) : (
            <>
              <label>
                <span>Rol</span>
                <select
                  value={staffForm.role}
                  onChange={(event) =>
                    setStaffForm((current) => ({ ...current, role: event.target.value }))
                  }
                >
                  <option value="admin">Admin</option>
                  <option value="tesorero">Tesorero</option>
                </select>
              </label>
              <label>
                <span>Usuario</span>
                <input
                  value={staffForm.username}
                  onChange={(event) =>
                    setStaffForm((current) => ({ ...current, username: event.target.value }))
                  }
                  required
                />
              </label>
              <label>
                <span>Contraseña</span>
                <input
                  value={staffForm.password}
                  onChange={(event) =>
                    setStaffForm((current) => ({ ...current, password: event.target.value }))
                  }
                  type="password"
                  required
                />
              </label>
            </>
          )}

          {error ? <p className="form-error">{error}</p> : null}

          <button className="primary-button" disabled={loading} type="submit">
            {loading ? "Ingresando..." : "Entrar"}
          </button>
        </form>
      </section>
    </main>
  );
}
