import { useEffect, useMemo, useState } from "react";
import { LayoutShell } from "../components/LayoutShell.jsx";
import { MapView } from "../components/MapView.jsx";
import { StatusBadge } from "../components/StatusBadge.jsx";
import { apiRequest } from "../lib/api.js";
import { formatCurrency, formatDate, formatQuotas } from "../lib/formatters.js";

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
      <article className="glass-card side-card form-card-compact">
        <div className="card-heading">
          <p className="eyebrow">Registro de pagos</p>
          <h2>Selecciona una dirección</h2>
        </div>
        <p className="subtitle">
          Busca un vecino para registrar o editar pagos sin mezclar el formulario con el mapa.
        </p>
      </article>
    );
  }

  return (
    <article className="glass-card side-card form-card-compact">
      <div className="card-heading">
        <p className="eyebrow">Registro de pagos</p>
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

function ConceptQuotaRow({ concept, label }) {
  return (
    <div className="quota-progress-row">
      <span>{label}</span>
      <strong>
        {formatQuotas(concept.equivalentQuotas)} de {formatQuotas(concept.totalQuotas)} cuotas
      </strong>
    </div>
  );
}

function TreasurerSummaryCards({ paymentState }) {
  return (
    <article className="glass-card side-card">
      <div className="card-heading">
        <p className="eyebrow">Resumen de pagos</p>
        <h2>Estado comunidad 2026</h2>
      </div>

      <div className="summary-grid compact">
        <div>
          <span>Total direcciones</span>
          <strong>{paymentState.totalDirecciones}</strong>
        </div>
        <div>
          <span>Sin firma</span>
          <strong>{paymentState.vecinosSinFirma}</strong>
        </div>
        <div>
          <span>Recaudado portones</span>
          <strong>{formatCurrency(paymentState.totalRecaudadoPortones)}</strong>
        </div>
        <div>
          <span>Recaudado mantención</span>
          <strong>{formatCurrency(paymentState.totalRecaudadoMantencion)}</strong>
        </div>
      </div>

      <div className="executive-rows">
        {[
          ["Portones", paymentState.conceptos.PORTONES],
          ["Mantención", paymentState.conceptos.MANTENCION],
        ].map(([label, counts]) => (
          <div className="executive-row" key={label}>
            <strong>{label}</strong>
            <span>
              Vecinos al día
              <b>{counts.alDia}</b>
            </span>
            <span>
              Vecinos atrasados
              <b>{counts.atrasados}</b>
            </span>
          </div>
        ))}
      </div>
    </article>
  );
}

function StreetExecutiveSummary({ streetSummary }) {
  return (
    <article className="glass-card side-card">
      <div className="card-heading">
        <p className="eyebrow">Resumen por pasaje</p>
        <h2>Lectura rápida</h2>
      </div>

      <div className="street-executive-list">
        {streetSummary.map((street) => (
          <div className="street-executive-row" key={street.pasaje}>
            <div className="street-title-block">
              <strong>{street.pasaje}</strong>
              <span>{street.totalDirecciones} direcciones</span>
            </div>
            <div className="street-executive-metrics">
              <span>
                Al día
                <b>{street.vecinosAlDia}</b>
              </span>
              <span>
                Atrasados
                <b>{street.vecinosAtrasados}</b>
              </span>
              <span>
                Sin firma
                <b>{street.firmasNo}</b>
              </span>
            </div>
          </div>
        ))}
      </div>
    </article>
  );
}

function SelectedNeighborSummary({ ledger }) {
  if (!ledger) {
    return null;
  }

  return (
    <article className="glass-card side-card">
      <div className="card-heading">
        <p className="eyebrow">Estado financiero</p>
        <h2>{ledger.summary.direccion}</h2>
      </div>

      <div className="neighbor-summary-header">
        <StatusBadge value={ledger.summary.generalStatus} />
        <strong className="marker-chip">{ledger.summary.markerLabel}</strong>
      </div>

      <div className="summary-grid compact">
        <div>
          <span>Total abonado</span>
          <strong>{formatCurrency(ledger.summary.totalCollected)}</strong>
        </div>
        <div>
          <span>Saldo pendiente</span>
          <strong>{formatCurrency(ledger.summary.totalPending)}</strong>
        </div>
      </div>

      <div className="quota-progress-card">
        <ConceptQuotaRow
          concept={ledger.summary.concepts.PORTONES}
          label="Portones 2026"
        />
        <ConceptQuotaRow
          concept={ledger.summary.concepts.MANTENCION}
          label="Mantención 2026"
        />
      </div>
    </article>
  );
}

function LedgerTable({ ledger, onEdit }) {
  if (!ledger) {
    return null;
  }

  return (
    <article className="glass-card side-card wide-card">
      <div className="card-heading">
        <p className="eyebrow">Pagos registrados</p>
        <h2>Historial de movimientos</h2>
      </div>

      <div className="table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th>Fecha</th>
              <th>Tipo</th>
              <th>Monto</th>
              <th>Cuotas</th>
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
                    onClick={() => onEdit(payment)}
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
  );
}

function OverviewTable({ financials, onExport, exporting }) {
  const [filter, setFilter] = useState("");

  const rows = useMemo(() => {
    const term = filter.trim().toUpperCase();

    return financials.filter((item) => {
      if (!term) {
        return true;
      }

      return (
        item.direccion.toUpperCase().includes(term)
        || item.pasaje.toUpperCase().includes(term)
        || `${item.numeracion}`.includes(term)
        || `${item.representanteNombre ?? ""}`.toUpperCase().includes(term)
      );
    });
  }, [filter, financials]);

  return (
    <section className="stack-form">
      <article className="glass-card side-card">
        <div className="card-heading">
          <p className="eyebrow">Vista general</p>
          <h2>Direcciones y estados financieros</h2>
        </div>

        <div className="overview-toolbar">
          <input
            className="search-input"
            value={filter}
            onChange={(event) => setFilter(event.target.value)}
            placeholder="Filtrar por pasaje, dirección o representante"
          />
          <button className="ghost-button" disabled={exporting} onClick={onExport} type="button">
            {exporting ? "Exportando..." : "Exportar Excel ejecutivo"}
          </button>
        </div>

        <div className="table-wrap executive-table-wrap">
          <table className="data-table executive-table">
            <thead>
              <tr>
                <th>Dirección</th>
                <th>Representante</th>
                <th>Firma</th>
                <th>Estado</th>
                <th>Portones 2026</th>
                <th>Mantención 2026</th>
                <th>Total abonado</th>
                <th>Saldo</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((item) => (
                <tr key={item.vecinoId}>
                  <td>
                    <strong>{item.direccion}</strong>
                    <div className="muted-cell">{item.pasaje}</div>
                  </td>
                  <td>
                    <strong>{item.representanteNombre || "Sin representante"}</strong>
                    <div className="muted-cell">{item.telefono || "Sin teléfono"}</div>
                  </td>
                  <td>{item.firmaVobo ? "Sí" : "No"}</td>
                  <td><StatusBadge value={item.generalStatus} /></td>
                  <td>
                    {formatQuotas(item.concepts.PORTONES.equivalentQuotas)} de {formatQuotas(item.concepts.PORTONES.totalQuotas)}
                  </td>
                  <td>
                    {formatQuotas(item.concepts.MANTENCION.equivalentQuotas)} de {formatQuotas(item.concepts.MANTENCION.totalQuotas)}
                  </td>
                  <td>{formatCurrency(item.totalCollected)}</td>
                  <td>{formatCurrency(item.totalPending)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </article>
    </section>
  );
}

export function TreasurerDashboardPage() {
  const [overview, setOverview] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [search, setSearch] = useState("");
  const [results, setResults] = useState([]);
  const [selectedVecino, setSelectedVecino] = useState(null);
  const [ledger, setLedger] = useState(null);
  const [selectedPayment, setSelectedPayment] = useState(null);
  const [activeTab, setActiveTab] = useState("resumen");
  const [exporting, setExporting] = useState(false);

  async function loadOverview() {
    setLoading(true);
    setLoadError("");

    try {
      const response = await apiRequest("/dashboard/overview");
      setOverview(response);
    } catch (error) {
      setLoadError(error.message);
    } finally {
      setLoading(false);
    }
  }

  async function loadLedger(vecinoId) {
    const response = await apiRequest(`/pagos/vecinos/${vecinoId}`);
    setLedger(response);
    setSelectedPayment(null);
  }

  async function handleExport() {
    setExporting(true);

    try {
      const year = new Date().getFullYear();
      const blob = await apiRequest(`/dashboard/export-excel?year=${year}`, {
        responseType: "blob",
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `comunidad-export-${year}.xlsx`;
      link.click();
      URL.revokeObjectURL(url);
    } finally {
      setExporting(false);
    }
  }

  useEffect(() => {
    loadOverview();
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

  if (loading) {
    return <div className="centered-screen">Cargando dashboard tesorero...</div>;
  }

  if (loadError) {
    return (
      <div className="centered-screen">
        <div className="stack-form" style={{ width: "min(32rem, 92vw)" }}>
          <strong>No se pudo cargar el panel tesorero.</strong>
          <p className="form-error">{loadError}</p>
          <button className="primary-button" onClick={() => loadOverview()} type="button">
            Reintentar
          </button>
        </div>
      </div>
    );
  }

  if (!overview) {
    return <div className="centered-screen">No hay datos disponibles.</div>;
  }

  return (
    <LayoutShell
      title="Panel tesorero"
      subtitle="Registro seguro de pagos, resumen claro de cobros y mapa comunitario separado del flujo de caja."
    >
      <main className="operations-layout operations-layout-single">
        <section className="section-tabs">
          <button
            className={activeTab === "resumen" ? "section-tab active" : "section-tab"}
            onClick={() => setActiveTab("resumen")}
            type="button"
          >
            Resumen y pagos
          </button>
          <button
            className={activeTab === "mapa" ? "section-tab active" : "section-tab"}
            onClick={() => setActiveTab("mapa")}
            type="button"
          >
            Mapa comunitario
          </button>
          <button
            className={activeTab === "vista" ? "section-tab active" : "section-tab"}
            onClick={() => setActiveTab("vista")}
            type="button"
          >
            Vista general
          </button>
        </section>

        {activeTab === "resumen" ? (
          <section className="treasurer-workbench">
            <div className="operations-sidebar">
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
                      className={selectedVecino?.id === row.id ? "result-row active" : "result-row"}
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
            </div>

            <div className="operations-sidebar">
              <TreasurerSummaryCards paymentState={overview.paymentState} />
              <StreetExecutiveSummary streetSummary={overview.streetSummary} />

              <SelectedNeighborSummary ledger={ledger} />

              <LedgerTable
                ledger={ledger}
                onEdit={(payment) => setSelectedPayment(payment)}
              />
            </div>
          </section>
        ) : null}

        {activeTab === "mapa" ? (
          <MapView
            active={activeTab === "mapa"}
            markers={overview.markers}
            streetSummary={overview.streetSummary}
            paymentState={overview.paymentState}
          />
        ) : null}

        {activeTab === "vista" ? (
          <OverviewTable
            exporting={exporting}
            financials={overview.financials}
            onExport={handleExport}
          />
        ) : null}
      </main>
    </LayoutShell>
  );
}
