import { useEffect, useState } from "react";
import { LayoutShell } from "../components/LayoutShell.jsx";
import { StatusBadge } from "../components/StatusBadge.jsx";
import { apiRequest } from "../lib/api.js";
import { formatCurrency, formatDate, formatQuotas } from "../lib/formatters.js";

function quotaCountText(concept) {
  return `${formatQuotas(concept.equivalentQuotas)} de ${formatQuotas(concept.totalQuotas)}`;
}

export function NeighborDashboardPage() {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    apiRequest("/vecino/portal")
      .then(setData)
      .catch((requestError) => setError(requestError.message));
  }, []);

  if (error) {
    return <div className="centered-screen">{error}</div>;
  }

  if (!data) {
    return <div className="centered-screen">Cargando panel vecino...</div>;
  }

  return (
    <LayoutShell
      title="Panel vecino"
      subtitle="Tu estado financiero 2026, tus cuotas pagadas y un contexto anónimo fácil de entender."
    >
      <main className="neighbor-layout">
        <section className="glass-card">
          <div className="card-heading">
            <p className="eyebrow">Estado general</p>
            <h2>{data.summary.direccion}</h2>
          </div>

          <div className="hero-summary">
            <StatusBadge value={data.summary.generalStatus} />
            <div className="summary-metrics">
              <div>
                <span>Total abonado</span>
                <strong>{formatCurrency(data.summary.totalCollected)}</strong>
              </div>
              <div>
                <span>Saldo pendiente</span>
                <strong>{formatCurrency(data.summary.totalPending)}</strong>
              </div>
              <div>
                <span>Marcador</span>
                <strong>{data.summary.markerLabel}</strong>
              </div>
            </div>
          </div>
        </section>

        <section className="two-column-grid">
          <article className="glass-card">
            <div className="card-heading">
              <p className="eyebrow">Detalle por concepto</p>
              <h2>Portones y mantención</h2>
            </div>

            {["PORTONES", "MANTENCION"].map((concept) => (
              <div className="concept-block" key={concept}>
                <div className="concept-title-row">
                  <strong>{concept === "PORTONES" ? "Portones" : "Mantención"}</strong>
                  <StatusBadge value={data.summary.concepts[concept].status} />
                </div>
                <div className="summary-grid">
                  <div>
                    <span>Cuotas pagadas 2026</span>
                    <strong>{quotaCountText(data.summary.concepts[concept])}</strong>
                  </div>
                  <div>
                    <span>Saldo</span>
                    <strong>{formatCurrency(data.summary.concepts[concept].pendingAmount)}</strong>
                  </div>
                  <div>
                    <span>Total abonado</span>
                    <strong>{formatCurrency(data.summary.concepts[concept].totalPaid)}</strong>
                  </div>
                  <div>
                    <span>Cuotas esperadas hoy</span>
                    <strong>{formatQuotas(data.summary.concepts[concept].expectedQuotas)}</strong>
                  </div>
                </div>
              </div>
            ))}
          </article>

          <article className="glass-card">
            <div className="card-heading">
              <p className="eyebrow">Comparativo comunidad</p>
              <h2>Contexto anónimo</h2>
            </div>

            <div className="summary-grid">
              <div>
                <span>Vecinos al día en la comunidad</span>
                <strong>{data.comparison.comunidadAlDia} / {data.comparison.comunidadTotal}</strong>
              </div>
              <div>
                <span>Vecinos al día en {data.comparison.pasaje}</span>
                <strong>{data.comparison.pasajeAlDia} / {data.comparison.pasajeTotal}</strong>
              </div>
              <div>
                <span>Portones 2026</span>
                <strong>{data.comparison.resumenPortones}</strong>
              </div>
              <div>
                <span>Mantención 2026</span>
                <strong>{data.comparison.resumenMantencion}</strong>
              </div>
            </div>

            <p className="message-card">{data.comparison.message}</p>
          </article>
        </section>

        <section className="glass-card">
          <div className="card-heading">
            <p className="eyebrow">Pagos registrados</p>
            <h2>Detalle histórico</h2>
          </div>

          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Tipo</th>
                  <th>Monto</th>
                  <th>Cuotas equivalentes</th>
                  <th>Origen</th>
                </tr>
              </thead>
              <tbody>
                {data.payments.map((payment) => (
                  <tr key={payment.id}>
                    <td>{formatDate(payment.fecha_pago)}</td>
                    <td>{payment.concepto}</td>
                    <td>{formatCurrency(payment.monto)}</td>
                    <td>{formatQuotas(payment.equivalentQuotas)}</td>
                    <td>{payment.source}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </main>
    </LayoutShell>
  );
}
