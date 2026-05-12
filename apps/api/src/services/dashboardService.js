import { query } from "../db/pool.js";
import {
  computeConceptProgress,
  computeGeneralStatus,
  formatMarkerLabel,
  roundCurrency,
  roundQuotas,
} from "../lib/finance.js";
import { normalizeConcept } from "../lib/normalizers.js";

function isUpToDateStatus(status) {
  return status === "Al día" || status === "Adelantado";
}

function getOrderedConfigs(configs) {
  return Object.values(configs).sort((a, b) => {
    if (Number(a.anio) !== Number(b.anio)) {
      return Number(a.anio) - Number(b.anio);
    }

    if (Number(a.mes_inicio ?? 1) !== Number(b.mes_inicio ?? 1)) {
      return Number(a.mes_inicio ?? 1) - Number(b.mes_inicio ?? 1);
    }

    return a.concepto.localeCompare(b.concepto, "es");
  });
}

function countConceptStatuses(financials, conceptKey) {
  return financials.reduce(
    (acc, item) => {
      const concept = item.concepts[conceptKey];

      if (!concept) {
        return acc;
      }

      const status = concept.status;

      if (isUpToDateStatus(status)) {
        acc.alDia += 1;
      } else {
        acc.atrasados += 1;
      }

      return acc;
    },
    {
      alDia: 0,
      atrasados: 0,
    },
  );
}

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
      select vecino_id, upper(concepto) as concepto, coalesce(sum(monto), 0) as total_paid
      from pagos
      where deleted_at is null
        and coalesce(source, '') <> 'excel_resumen'
      group by vecino_id, upper(concepto)
    `,
  );

  return result.rows.reduce((acc, row) => {
    const key = `${row.vecino_id}:${normalizeConcept(row.concepto)}`;
    acc[key] = Number(row.total_paid);
    return acc;
  }, {});
}

export function buildVecinoFinancialSummary(vecino, totalsMap, configs, today = new Date()) {
  const orderedConfigs = getOrderedConfigs(configs);
  const conceptsMap = Object.fromEntries(
    orderedConfigs.map((config) => [
      config.concepto,
      computeConceptProgress(
        totalsMap[`${vecino.id}:${config.concepto}`] ?? 0,
        config,
        today,
      ),
    ]),
  );
  const concepts = Object.values(conceptsMap);
  const generalStatus = computeGeneralStatus({
    hasSignature: vecino.firma_vobo,
    concepts,
  });
  const totalCollected = roundCurrency(concepts.reduce((sum, item) => sum + item.totalPaid, 0));
  const totalPending = roundCurrency(concepts.reduce((sum, item) => sum + item.pendingAmount, 0));
  const progressPercentage = roundQuotas(
    concepts.length
      ? concepts.reduce((sum, item) => sum + item.progressPercentage, 0) / concepts.length
      : 0,
  );
  const markerConcepts = concepts.slice(0, 2);
  const markerLabel = formatMarkerLabel(
    markerConcepts[0]?.equivalentQuotas ?? 0,
    markerConcepts[1]?.equivalentQuotas ?? 0,
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
    concepts: conceptsMap,
    conceptsList: orderedConfigs.map((config) => ({
      concept: config.concepto,
      anio: Number(config.anio),
      mesInicio: Number(config.mes_inicio ?? 1),
      activo: Boolean(config.activo),
      ...conceptsMap[config.concepto],
    })),
    markerLabel,
  };
}

export function buildCommunityComparison(financials) {
  const total = financials.length;
  const upToDate = financials.filter((item) =>
    item.generalStatus === "Al día" || item.generalStatus === "Adelantado",
  ).length;
  const withoutSignature = financials.filter((item) => item.generalStatus === "Sin firma").length;
  const delayed = financials.filter((item) => item.generalStatus === "Atrasado").length;
  const conceptKeys = Array.from(
    new Set(financials.flatMap((item) => Object.keys(item.concepts))),
  ).sort((a, b) => a.localeCompare(b, "es"));
  const conceptStats = Object.fromEntries(
    conceptKeys.map((conceptKey) => {
      const statusCounts = countConceptStatuses(financials, conceptKey);

      return [
        conceptKey,
        {
          totalRecaudado: roundCurrency(
            financials.reduce((sum, item) => sum + (item.concepts[conceptKey]?.totalPaid ?? 0), 0),
          ),
          alDia: statusCounts.alDia,
          atrasados: statusCounts.atrasados,
        },
      ];
    }),
  );
  const avgAdvance =
    total === 0
      ? 0
      : roundQuotas(
          financials.reduce((sum, item) => sum + item.progressPercentage, 0) / total,
        );

  return {
    totalDirecciones: total,
    totalRecaudadoPortones: conceptStats.PORTONES?.totalRecaudado ?? 0,
    totalRecaudadoMantencion: conceptStats.MANTENCION?.totalRecaudado ?? 0,
    totalRecaudadoTotal: roundCurrency(
      Object.values(conceptStats).reduce((sum, item) => sum + item.totalRecaudado, 0),
    ),
    vecinosAlDia: upToDate,
    vecinosAtrasados: delayed,
    vecinosSinFirma: withoutSignature,
    porcentajeAvance: avgAdvance,
    conceptos: conceptStats,
    conceptsList: conceptKeys.map((conceptKey) => ({
      concept: conceptKey,
      ...conceptStats[conceptKey],
    })),
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
        totalRecaudado: 0,
        totalAvance: 0,
        vecinosAlDia: 0,
        vecinosAtrasados: 0,
        conceptos: {},
      });
    }

    const bucket = grouped.get(key);
    bucket.totalDirecciones += 1;
    bucket.firmasSi += item.firmaVobo ? 1 : 0;
    bucket.firmasNo += item.firmaVobo ? 0 : 1;
    bucket.totalRecaudado += item.totalCollected;
    bucket.totalAvance += item.progressPercentage;
    bucket.vecinosAlDia +=
      item.generalStatus === "Al día" || item.generalStatus === "Adelantado" ? 1 : 0;
    bucket.vecinosAtrasados +=
      item.generalStatus === "Atrasado" || item.generalStatus === "Parcial" ? 1 : 0;

    Object.entries(item.concepts).forEach(([conceptKey, concept]) => {
      if (!bucket.conceptos[conceptKey]) {
        bucket.conceptos[conceptKey] = {
          alDia: 0,
          atrasados: 0,
          totalRecaudado: 0,
          totalCuotas: 0,
        };
      }

      bucket.conceptos[conceptKey][
        isUpToDateStatus(concept.status) ? "alDia" : "atrasados"
      ] += 1;
      bucket.conceptos[conceptKey].totalRecaudado += concept.totalPaid;
      bucket.conceptos[conceptKey].totalCuotas += concept.equivalentQuotas;
    });
  }

  return Array.from(grouped.values())
    .map((item) => ({
      pasaje: item.pasaje,
      totalDirecciones: item.totalDirecciones,
      firmasSi: item.firmasSi,
      firmasNo: item.firmasNo,
      promedioCuotasPortones: roundQuotas(
        (item.conceptos.PORTONES?.totalCuotas ?? 0) / item.totalDirecciones,
      ),
      promedioCuotasMantencion: roundQuotas(
        (item.conceptos.MANTENCION?.totalCuotas ?? 0) / item.totalDirecciones,
      ),
      totalRecaudado: roundCurrency(item.totalRecaudado),
      porcentajeAvance: roundQuotas(item.totalAvance / item.totalDirecciones),
      vecinosAlDia: item.vecinosAlDia,
      vecinosAtrasados: item.vecinosAtrasados,
      conceptos: item.conceptos,
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
        concepts: item.conceptsList,
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
