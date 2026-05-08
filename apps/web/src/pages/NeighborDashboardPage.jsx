import { useEffect, useState } from "react";
import { LayoutShell } from "../components/LayoutShell.jsx";
import { StatusBadge } from "../components/StatusBadge.jsx";
import { apiRequest } from "../lib/api.js";
import { formatCurrency, formatDate, formatPercent, formatQuotas } from "../lib/formatters.js";

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
      subtitle="Tu estado financiero, detalle de pagos y comparativo anónimo con la comunidad."
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
                <span>Avance</span>
                <strong>{formatPercent(data.summary.progressPercentage)}</strong>
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
                    <span>Cuotas equivalentes</span>
                    <strong>{formatQuotas(data.summary.concepts[concept].equivalentQuotas)}</strong>
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
                    <span>Avance</span>
                    <strong>{formatPercent(data.summary.concepts[concept].progressPercentage)}</strong>
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
                <span>% vecinos al día</span>
                <strong>{formatPercent(data.comparison.porcentajeVecinosAlDia)}</strong>
              </div>
              <div>
                <span>Promedio comunidad</span>
                <strong>{formatPercent(data.comparison.promedioComunidad)}</strong>
              </div>
              <div>
                <span>Avance relativo</span>
                <strong>{formatPercent(data.comparison.avanceRelativo)}</strong>
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

