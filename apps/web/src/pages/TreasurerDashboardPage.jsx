import { useEffect, useState } from "react";
import { LayoutShell } from "../components/LayoutShell.jsx";
import { MapView } from "../components/MapView.jsx";
import { StatusBadge } from "../components/StatusBadge.jsx";
import { apiRequest } from "../lib/api.js";
import { formatCurrency, formatDate, formatPercent, formatQuotas } from "../lib/formatters.js";

function PaymentEditor({
  selectedVecino,
  selectedPayment,
  onSaved,
}) {
  const [form, setForm] = useState({
    concepto: "PORTONES",
    fechaPago: new Date().toISOString().slice(0, 10),
    monto: "",
    observacion: "",
  });
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (selectedPayment) {
      setForm({
        concepto: selectedPayment.concepto,
        fechaPago: selectedPayment.fecha_pago,
        monto: selectedPayment.monto,
        observacion: selectedPayment.observacion ?? "",
      });
      return;
    }

    setForm({
      concepto: "PORTONES",
      fechaPago: new Date().toISOString().slice(0, 10),
      monto: "",
      observacion: "",
    });
  }, [selectedPayment]);

  async function handleSubmit(event) {
    event.preventDefault();
    setSaving(true);
    setMessage("");

    try {
      if (selectedPayment) {
        await apiRequest(`/pagos/${selectedPayment.id}`, {
          method: "PUT",
          body: {
            ...form,
            monto: Number(form.monto),
          },
        });
      } else {
        await apiRequest("/pagos", {
          method: "POST",
          body: {
            vecinoId: selectedVecino.id,
            ...form,
            monto: Number(form.monto),
          },
        });
      }

      setMessage("Pago guardado correctamente.");
      await onSaved();
    } catch (error) {
      setMessage(error.message);
    } finally {
      setSaving(false);
    }
  }

  if (!selectedVecino) {
    return (
      <article className="glass-card side-card">
        <div className="card-heading">
          <p className="eyebrow">Formulario tesorero</p>
          <h2>Selecciona una dirección</h2>
        </div>
      </article>
    );
  }

  return (
    <article className="glass-card side-card">
      <div className="card-heading">
        <p className="eyebrow">Formulario tesorero</p>
        <h2>{selectedVecino.direccion}</h2>
      </div>

      <form className="stack-form" onSubmit={handleSubmit}>
        <label>
          <span>Tipo</span>
          <select
            value={form.concepto}
            onChange={(event) =>
              setForm((current) => ({ ...current, concepto: event.target.value }))
            }
          >
            <option value="PORTONES">Portones</option>
            <option value="MANTENCION">Mantención</option>
          </select>
        </label>
        <label>
          <span>Fecha</span>
          <input
            type="date"
            value={form.fechaPago}
            onChange={(event) =>
              setForm((current) => ({ ...current, fechaPago: event.target.value }))
            }
            required
          />
        </label>
        <label>
          <span>Monto</span>
          <input
            value={form.monto}
            inputMode="numeric"
            onChange={(event) =>
              setForm((current) => ({ ...current, monto: event.target.value }))
            }
            required
          />
        </label>
        <label>
          <span>Observación</span>
          <textarea
            value={form.observacion}
            onChange={(event) =>
              setForm((current) => ({ ...current, observacion: event.target.value }))
            }
            rows={3}
          />
        </label>

        {message ? <p className="inline-message">{message}</p> : null}

        <button className="primary-button" disabled={saving} type="submit">
          {saving ? "Guardando..." : selectedPayment ? "Actualizar pago" : "Registrar pago"}
        </button>
      </form>
    </article>
  );
}

export function TreasurerDashboardPage() {
  const [overview, setOverview] = useState(null);
  const [search, setSearch] = useState("");
  const [results, setResults] = useState([]);
  const [selectedVecino, setSelectedVecino] = useState(null);
  const [ledger, setLedger] = useState(null);
  const [selectedPayment, setSelectedPayment] = useState(null);

  async function loadOverview() {
    const response = await apiRequest("/dashboard/overview");
    setOverview(response);
  }

  async function loadLedger(vecinoId) {
    const response = await apiRequest(`/pagos/vecinos/${vecinoId}`);
    setLedger(response);
    setSelectedPayment(null);
  }

  useEffect(() => {
    loadOverview().catch(console.error);
  }, []);

  useEffect(() => {
    if (!search.trim()) {
      setResults([]);
      return;
    }

    const timer = setTimeout(() => {
      apiRequest(`/pagos/vecinos?q=${encodeURIComponent(search)}`)
        .then((response) => setResults(response.rows))
        .catch(console.error);
    }, 250);

    return () => clearTimeout(timer);
  }, [search]);

  if (!overview) {
    return <div className="centered-screen">Cargando dashboard tesorero...</div>;
  }

  return (
    <LayoutShell
      title="Panel tesorero"
      subtitle="Registro seguro de pagos, visibilidad GIS y cálculo automático de cuotas equivalentes."
    >
      <main className="operations-layout">
        <MapView
          markers={overview.markers}
          streetSummary={overview.streetSummary}
          paymentState={overview.paymentState}
        />

        <section className="operations-sidebar">
          <article className="glass-card side-card">
            <div className="card-heading">
              <p className="eyebrow">Buscar dirección</p>
              <h2>Seleccionar vecino</h2>
            </div>

            <input
              className="search-input"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Ej. EL MANZANAL 3675"
            />

            <div className="search-results">
              {results.map((row) => (
                <button
                  className="result-row"
                  key={row.id}
                  onClick={() => {
                    setSelectedVecino(row);
                    loadLedger(row.id).catch(console.error);
                  }}
                  type="button"
                >
                  <strong>{row.direccion}</strong>
                  <span>{row.representante_nombre}</span>
                </button>
              ))}
            </div>
          </article>

          <PaymentEditor
            selectedVecino={selectedVecino}
            selectedPayment={selectedPayment}
            onSaved={async () => {
              if (selectedVecino) {
                await Promise.all([loadLedger(selectedVecino.id), loadOverview()]);
              }
            }}
          />

          {ledger ? (
            <article className="glass-card side-card">
              <div className="card-heading">
                <p className="eyebrow">Estado financiero</p>
                <h2>{ledger.summary.direccion}</h2>
              </div>
              <StatusBadge value={ledger.summary.generalStatus} />

              <div className="summary-grid compact">
                <div>
                  <span>Total abonado</span>
                  <strong>{formatCurrency(ledger.summary.totalCollected)}</strong>
                </div>
                <div>
                  <span>Saldo</span>
                  <strong>{formatCurrency(ledger.summary.totalPending)}</strong>
                </div>
                <div>
                  <span>Avance</span>
                  <strong>{formatPercent(ledger.summary.progressPercentage)}</strong>
                </div>
                <div>
                  <span>Marcador</span>
                  <strong>{ledger.summary.markerLabel}</strong>
                </div>
              </div>

              <div className="table-wrap">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Fecha</th>
                      <th>Tipo</th>
                      <th>Monto</th>
                      <th>Eq.</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {ledger.payments.map((payment) => (
                      <tr key={payment.id}>
                        <td>{formatDate(payment.fecha_pago)}</td>
                        <td>{payment.concepto}</td>
                        <td>{formatCurrency(payment.monto)}</td>
                        <td>{formatQuotas(payment.equivalentQuotas)}</td>
                        <td>
                          <button
                            className="table-link"
                            onClick={() => setSelectedPayment(payment)}
                            type="button"
                          >
                            Editar
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </article>
          ) : null}
        </section>
      </main>
    </LayoutShell>
  );
}

