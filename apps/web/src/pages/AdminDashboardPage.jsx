import { useEffect, useState } from "react";
import { LayoutShell } from "../components/LayoutShell.jsx";
import { MapView } from "../components/MapView.jsx";
import { apiRequest } from "../lib/api.js";
import { formatCurrency, formatDate } from "../lib/formatters.js";

export function AdminDashboardPage() {
  const [overview, setOverview] = useState(null);
  const [audit, setAudit] = useState([]);
  const [vecinoSearch, setVecinoSearch] = useState("");
  const [vecinoResults, setVecinoResults] = useState([]);
  const [selectedVecino, setSelectedVecino] = useState(null);
  const [temporaryPin, setTemporaryPin] = useState("");
  const [configForm, setConfigForm] = useState({});
  const [treasurerForm, setTreasurerForm] = useState({
    username: "",
    password: "",
    fullName: "",
    phone: "",
  });
  const [importFile, setImportFile] = useState(null);
  const [message, setMessage] = useState("");

  async function loadAdminData() {
    const [overviewResponse, auditResponse] = await Promise.all([
      apiRequest("/dashboard/overview"),
      apiRequest("/admin/auditoria?limit=120"),
    ]);

    setOverview(overviewResponse);
    setAudit(auditResponse.rows);
    setConfigForm({
      PORTONES: overviewResponse.configs.PORTONES,
      MANTENCION: overviewResponse.configs.MANTENCION,
    });
  }

  useEffect(() => {
    loadAdminData().catch(console.error);
  }, []);

  useEffect(() => {
    if (!vecinoSearch.trim()) {
      setVecinoResults([]);
      return;
    }

    const timer = setTimeout(() => {
      apiRequest(`/admin/vecinos?q=${encodeURIComponent(vecinoSearch)}`)
        .then((response) => setVecinoResults(response.rows))
        .catch(console.error);
    }, 250);

    return () => clearTimeout(timer);
  }, [vecinoSearch]);

  async function handleConfigSave(concept) {
    await apiRequest(`/admin/configuracion-cobros/${concept}`, {
      method: "PUT",
      body: {
        cuotasTotales: Number(configForm[concept].cuotas_totales),
        valorCuota: Number(configForm[concept].valor_cuota),
        anio: Number(configForm[concept].anio),
        mesInicio: Number(configForm[concept].mes_inicio),
        activo: Boolean(configForm[concept].activo),
      },
    });
    setMessage(`Configuración ${concept} actualizada.`);
    await loadAdminData();
  }

  async function handleCreateTreasurer(event) {
    event.preventDefault();
    await apiRequest("/admin/tesoreros", {
      method: "POST",
      body: treasurerForm,
    });
    setMessage("Usuario tesorero creado o actualizado.");
    setTreasurerForm({
      username: "",
      password: "",
      fullName: "",
      phone: "",
    });
  }

  async function handleResetPin(mode = "phone_last4") {
    if (!selectedVecino) {
      return;
    }

    const response = await apiRequest("/admin/reset-neighbor-pin", {
      method: "POST",
      body: {
        vecinoId: selectedVecino.id,
        mode,
      },
    });
    setTemporaryPin(response.temporaryPin);
    setMessage("PIN temporal generado. El vecino deberá cambiarlo al entrar.");
    await loadAdminData();
  }

  async function handleImport(event) {
    event.preventDefault();

    if (!importFile) {
      setMessage("Selecciona un archivo Excel.");
      return;
    }

    const formData = new FormData();
    formData.append("file", importFile);
    formData.append("year", String(new Date().getFullYear()));
    formData.append("sosMode", "false");

    const response = await apiRequest("/admin/import-excel", {
      method: "POST",
      body: formData,
    });
    setMessage(
      `Importación completada: ${response.importedVecinos} vecinos y ${response.importedPayments} pagos.`,
    );
    await loadAdminData();
  }

  async function handleExport() {
    const year = new Date().getFullYear();
    const blob = await apiRequest(`/admin/export-excel?year=${year}`, {
      responseType: "blob",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `comunidad-export-${year}.xlsx`;
    link.click();
    URL.revokeObjectURL(url);
    setMessage("Exportación generada.");
  }

  if (!overview) {
    return <div className="centered-screen">Cargando panel admin...</div>;
  }

  return (
    <LayoutShell
      title="Panel admin"
      subtitle="Control total sobre configuración, auditoría, usuarios tesorero e importación/exportación Excel."
    >
      <main className="admin-layout">
        <MapView
          markers={overview.markers}
          streetSummary={overview.streetSummary}
          paymentState={overview.paymentState}
        />

        <section className="admin-columns">
          <article className="glass-card side-card">
            <div className="card-heading">
              <p className="eyebrow">Configuración global</p>
              <h2>Cobros</h2>
            </div>

            {["PORTONES", "MANTENCION"].map((concept) => (
              <div className="config-block" key={concept}>
                <strong>{concept}</strong>
                <label>
                  <span>Cuotas totales</span>
                  <input
                    value={configForm[concept]?.cuotas_totales ?? ""}
                    onChange={(event) =>
                      setConfigForm((current) => ({
                        ...current,
                        [concept]: {
                          ...current[concept],
                          cuotas_totales: event.target.value,
                        },
                      }))
                    }
                  />
                </label>
                <label>
                  <span>Valor cuota</span>
                  <input
                    value={configForm[concept]?.valor_cuota ?? ""}
                    onChange={(event) =>
                      setConfigForm((current) => ({
                        ...current,
                        [concept]: {
                          ...current[concept],
                          valor_cuota: event.target.value,
                        },
                      }))
                    }
                  />
                </label>
                <label>
                  <span>Año</span>
                  <input
                    value={configForm[concept]?.anio ?? ""}
                    onChange={(event) =>
                      setConfigForm((current) => ({
                        ...current,
                        [concept]: {
                          ...current[concept],
                          anio: event.target.value,
                        },
                      }))
                    }
                  />
                </label>
                <label>
                  <span>Mes inicio</span>
                  <input
                    value={configForm[concept]?.mes_inicio ?? ""}
                    onChange={(event) =>
                      setConfigForm((current) => ({
                        ...current,
                        [concept]: {
                          ...current[concept],
                          mes_inicio: event.target.value,
                        },
                      }))
                    }
                  />
                </label>

                <button className="primary-button" onClick={() => handleConfigSave(concept)}>
                  Guardar {concept}
                </button>
              </div>
            ))}
          </article>

          <article className="glass-card side-card">
            <div className="card-heading">
              <p className="eyebrow">Usuarios</p>
              <h2>Crear tesorero</h2>
            </div>

            <form className="stack-form" onSubmit={handleCreateTreasurer}>
              <input
                placeholder="Usuario"
                value={treasurerForm.username}
                onChange={(event) =>
                  setTreasurerForm((current) => ({ ...current, username: event.target.value }))
                }
              />
              <input
                placeholder="Contraseña"
                type="password"
                value={treasurerForm.password}
                onChange={(event) =>
                  setTreasurerForm((current) => ({ ...current, password: event.target.value }))
                }
              />
              <input
                placeholder="Nombre completo"
                value={treasurerForm.fullName}
                onChange={(event) =>
                  setTreasurerForm((current) => ({ ...current, fullName: event.target.value }))
                }
              />
              <input
                placeholder="Teléfono"
                value={treasurerForm.phone}
                onChange={(event) =>
                  setTreasurerForm((current) => ({ ...current, phone: event.target.value }))
                }
              />
              <button className="primary-button" type="submit">
                Guardar tesorero
              </button>
            </form>
          </article>

          <article className="glass-card side-card">
            <div className="card-heading">
              <p className="eyebrow">Contraseñas</p>
              <h2>Restaurar PIN vecino</h2>
            </div>

            <input
              className="search-input"
              value={vecinoSearch}
              onChange={(event) => setVecinoSearch(event.target.value)}
              placeholder="Buscar dirección"
            />

            <div className="search-results">
              {vecinoResults.map((row) => (
                <button
                  className={selectedVecino?.id === row.id ? "result-row active" : "result-row"}
                  key={row.id}
                  onClick={() => setSelectedVecino(row)}
                  type="button"
                >
                  <strong>{row.direccion}</strong>
                  <span>{row.representante_nombre}</span>
                </button>
              ))}
            </div>

            <div className="button-row">
              <button className="primary-button" onClick={() => handleResetPin("phone_last4")}>
                Usar últimos 4
              </button>
              <button className="ghost-button" onClick={() => handleResetPin("random")}>
                PIN aleatorio
              </button>
            </div>

            {temporaryPin ? <p className="inline-message">PIN temporal: {temporaryPin}</p> : null}
          </article>

          <article className="glass-card side-card">
            <div className="card-heading">
              <p className="eyebrow">Excel</p>
              <h2>Importar / exportar</h2>
            </div>

            <form className="stack-form" onSubmit={handleImport}>
              <input
                type="file"
                accept=".xlsx"
                onChange={(event) => setImportFile(event.target.files?.[0] ?? null)}
              />
              <button className="primary-button" type="submit">
                Importar Excel
              </button>
            </form>

            <button className="ghost-button wide" onClick={handleExport}>
              Exportar Excel recalculado
            </button>

            {message ? <p className="inline-message">{message}</p> : null}
          </article>

          <article className="glass-card side-card wide-card">
            <div className="card-heading">
              <p className="eyebrow">Auditoría obligatoria</p>
              <h2>Últimos movimientos</h2>
            </div>

            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Fecha</th>
                    <th>Usuario</th>
                    <th>Acción</th>
                    <th>Entidad</th>
                    <th>IP</th>
                  </tr>
                </thead>
                <tbody>
                  {audit.map((row) => (
                    <tr key={row.id}>
                      <td>{formatDate(row.created_at)}</td>
                      <td>{row.usuario_identificador}</td>
                      <td>{row.accion}</td>
                      <td>{row.entidad}</td>
                      <td>{row.ip}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </article>
        </section>
      </main>
    </LayoutShell>
  );
}

