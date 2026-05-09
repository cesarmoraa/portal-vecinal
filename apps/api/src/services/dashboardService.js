import { query } from "../db/pool.js";
import {
  computeConceptProgress,
  computeGeneralStatus,
  formatMarkerLabel,
  roundCurrency,
  roundQuotas,
} from "../lib/finance.js";
import { normalizeConcept } from "../lib/normalizers.js";

export async function fetchConfigs(db = { query }) {
  const result = await db.query(
    `
      select concepto, cuotas_totales, valor_cuota, anio, mes_inicio, activo
      from configuracion_cobros
      order by concepto
    `,
  );

  return result.rows.reduce((acc, row) => {
    acc[normalizeConcept(row.concepto)] = {
      ...row,
      concepto: normalizeConcept(row.concepto),
    };
    return acc;
  }, {});
}

export async function fetchVecinos(db = { query }) {
  const result = await db.query(
    `
      select
        v.id,
        v.pasaje,
        v.numeracion,
        v.comuna,
        v.pais,
        v.direccion,
        v.coordenadas,
        v.latitud,
        v.longitud,
        v.representante_nombre,
        v.telefono,
        v.firma_vobo
      from vecinos v
      order by v.pasaje, v.numeracion
    `,
  );

  return result.rows;
}

export async function fetchPaymentTotals(db = { query }) {
  const result = await db.query(
    `
      select vecino_id, concepto, coalesce(sum(monto), 0) as total_paid
      from pagos
      where deleted_at is null
      group by vecino_id, concepto
    `,
  );

  return result.rows.reduce((acc, row) => {
    const key = `${row.vecino_id}:${row.concepto}`;
    acc[key] = Number(row.total_paid);
    return acc;
  }, {});
}

export function buildVecinoFinancialSummary(vecino, totalsMap, configs, today = new Date()) {
  const portones = computeConceptProgress(
    totalsMap[`${vecino.id}:PORTONES`] ?? 0,
    configs.PORTONES,
    today,
  );
  const mantencion = computeConceptProgress(
    totalsMap[`${vecino.id}:MANTENCION`] ?? 0,
    configs.MANTENCION,
    today,
  );
  const concepts = [portones, mantencion];
  const generalStatus = computeGeneralStatus({
    hasSignature: vecino.firma_vobo,
    concepts,
  });
  const totalCollected = roundCurrency(portones.totalPaid + mantencion.totalPaid);
  const totalPending = roundCurrency(portones.pendingAmount + mantencion.pendingAmount);
  const progressPercentage = roundQuotas(
    concepts.reduce((sum, item) => sum + item.progressPercentage, 0) / concepts.length,
  );

  return {
    vecinoId: vecino.id,
    direccion: vecino.direccion,
    pasaje: vecino.pasaje,
    numeracion: vecino.numeracion,
    representanteNombre: vecino.representante_nombre,
    telefono: vecino.telefono,
    firmaVobo: vecino.firma_vobo,
    comuna: vecino.comuna,
    pais: vecino.pais,
    coordenadas: vecino.coordenadas,
    latitud: vecino.latitud ? Number(vecino.latitud) : null,
    longitud: vecino.longitud ? Number(vecino.longitud) : null,
    generalStatus,
    totalCollected,
    totalPending,
    progressPercentage,
    concepts: {
      PORTONES: portones,
      MANTENCION: mantencion,
    },
    markerLabel: formatMarkerLabel(portones.equivalentQuotas, mantencion.equivalentQuotas),
  };
}

export function buildCommunityComparison(financials) {
  const total = financials.length;
  const upToDate = financials.filter((item) =>
    item.generalStatus === "Al día" || item.generalStatus === "Adelantado",
  ).length;
  const withoutSignature = financials.filter((item) => item.generalStatus === "Sin firma").length;
  const delayed = financials.filter((item) => item.generalStatus === "Atrasado").length;
  const totalPortones = financials.reduce((sum, item) => sum + item.concepts.PORTONES.totalPaid, 0);
  const totalMantencion = financials.reduce(
    (sum, item) => sum + item.concepts.MANTENCION.totalPaid,
    0,
  );
  const avgAdvance =
    total === 0
      ? 0
      : roundQuotas(
          financials.reduce((sum, item) => sum + item.progressPercentage, 0) / total,
        );

  return {
    totalDirecciones: total,
    totalRecaudadoPortones: roundCurrency(totalPortones),
    totalRecaudadoMantencion: roundCurrency(totalMantencion),
    vecinosAlDia: upToDate,
    vecinosAtrasados: delayed,
    vecinosSinFirma: withoutSignature,
    porcentajeAvance: avgAdvance,
  };
}

export function buildStreetSummary(financials) {
  const grouped = new Map();

  for (const item of financials) {
    const key = item.pasaje;

    if (!grouped.has(key)) {
      grouped.set(key, {
        pasaje: key,
        totalDirecciones: 0,
        firmasSi: 0,
        firmasNo: 0,
        totalPortonesQuotas: 0,
        totalMantencionQuotas: 0,
        totalRecaudado: 0,
        totalAvance: 0,
      });
    }

    const bucket = grouped.get(key);
    bucket.totalDirecciones += 1;
    bucket.firmasSi += item.firmaVobo ? 1 : 0;
    bucket.firmasNo += item.firmaVobo ? 0 : 1;
    bucket.totalPortonesQuotas += item.concepts.PORTONES.equivalentQuotas;
    bucket.totalMantencionQuotas += item.concepts.MANTENCION.equivalentQuotas;
    bucket.totalRecaudado += item.totalCollected;
    bucket.totalAvance += item.progressPercentage;
  }

  return Array.from(grouped.values())
    .map((item) => ({
      pasaje: item.pasaje,
      totalDirecciones: item.totalDirecciones,
      firmasSi: item.firmasSi,
      firmasNo: item.firmasNo,
      promedioCuotasPortones: roundQuotas(item.totalPortonesQuotas / item.totalDirecciones),
      promedioCuotasMantencion: roundQuotas(item.totalMantencionQuotas / item.totalDirecciones),
      totalRecaudado: roundCurrency(item.totalRecaudado),
      porcentajeAvance: roundQuotas(item.totalAvance / item.totalDirecciones),
    }))
    .sort((a, b) => a.pasaje.localeCompare(b.pasaje, "es"));
}

export function buildMapMarkers(financials) {
  return financials
    .filter((item) => item.latitud && item.longitud)
    .map((item) => ({
      vecinoId: item.vecinoId,
      latitud: item.latitud,
      longitud: item.longitud,
      markerLabel: item.markerLabel,
      status: item.generalStatus,
      popup: {
        direccion: item.direccion,
        representanteNombre: item.representanteNombre,
        telefono: item.telefono,
        firmaVobo: item.firmaVobo ? "SI" : "NO",
        portones: item.concepts.PORTONES,
        mantencion: item.concepts.MANTENCION,
        totalCollected: item.totalCollected,
        totalPending: item.totalPending,
      },
    }));
}

export async function getDashboardOverview(today = new Date()) {
  const [configs, vecinos, totalsMap] = await Promise.all([
    fetchConfigs(),
    fetchVecinos(),
    fetchPaymentTotals(),
  ]);

  const financials = vecinos.map((vecino) =>
    buildVecinoFinancialSummary(vecino, totalsMap, configs, today),
  );

  return {
    generatedAt: today.toISOString(),
    configs,
    markers: buildMapMarkers(financials),
    streetSummary: buildStreetSummary(financials),
    paymentState: buildCommunityComparison(financials),
    financials,
  };
}
