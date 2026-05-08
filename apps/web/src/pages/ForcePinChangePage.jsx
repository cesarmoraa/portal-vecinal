import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";

export function ForcePinChangePage() {
  const { changePin, user } = useAuth();
  const navigate = useNavigate();
  const [currentPin, setCurrentPin] = useState("");
  const [newPin, setNewPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();

    if (newPin !== confirmPin) {
      setError("La confirmación del PIN no coincide.");
      return;
    }

    setSaving(true);
    setError("");

    try {
      await changePin({ currentPin, newPin });

      if (user.role === "vecino") {
        navigate("/vecino", { replace: true });
      } else if (user.role === "tesorero") {
        navigate("/tesorero", { replace: true });
      } else {
        navigate("/admin", { replace: true });
      }
    } catch (submitError) {
      setError(submitError.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="centered-screen">
      <section className="pin-card">
        <p className="eyebrow">Seguridad obligatoria</p>
        <h1>Cambia tu PIN antes de continuar</h1>
        <p>
          Tu acceso actual es temporal. El nuevo PIN debe tener exactamente 4 dígitos.
        </p>

        <form className="stack-form" onSubmit={handleSubmit}>
          <label>
            <span>PIN actual</span>
            <input
              value={currentPin}
              onChange={(event) => setCurrentPin(event.target.value)}
              inputMode="numeric"
              maxLength={4}
              required
            />
          </label>
          <label>
            <span>Nuevo PIN</span>
            <input
              value={newPin}
              onChange={(event) => setNewPin(event.target.value)}
              inputMode="numeric"
              maxLength={4}
              required
            />
          </label>
          <label>
            <span>Confirmar nuevo PIN</span>
            <input
              value={confirmPin}
              onChange={(event) => setConfirmPin(event.target.value)}
              inputMode="numeric"
              maxLength={4}
              required
            />
          </label>

          {error ? <p className="form-error">{error}</p> : null}

          <button className="primary-button" disabled={saving} type="submit">
            {saving ? "Guardando..." : "Actualizar PIN"}
          </button>
        </form>
      </section>
    </main>
  );
}

