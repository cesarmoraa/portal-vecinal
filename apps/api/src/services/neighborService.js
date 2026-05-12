import { query } from "../db/pool.js";
import { AppError } from "../lib/appError.js";
import { roundQuotas } from "../lib/finance.js";
import {
  buildCommunityComparison,
  buildVecinoFinancialSummary,
  fetchConfigs,
  fetchPaymentTotals,
  fetchVecinos,
} from "./dashboardService.js";

export async function listVecinos(searchText = "") {
  const pattern = `%${searchText.trim().toUpperCase()}%`;
  const result = await query(
    `
      select
        id,
        pasaje,
        numeracion,
        direccion,
        representante_nombre,
        telefono,
        firma_vobo
      from vecinos
      where
        upper(pasaje) like $1
        or cast(numeracion as text) like $1
        or upper(direccion) like $1
      order by pasaje, numeracion
      limit 20
    `,
    [pattern],
  );

  return result.rows;
}

export async function getVecinoLedger(vecinoId) {
  const [vecinos, configs, totalsMap, paymentsResult] = await Promise.all([
    fetchVecinos(),
    fetchConfigs(),
    fetchPaymentTotals(),
    query(
      `
        select
          id,
          concepto,
          monto,
          fecha_pago,
          observacion,
          period_year,
          period_month,
          source
        from pagos
        where vecino_id = $1
          and deleted_at is null
          and coalesce(source, '') <> 'excel_resumen'
        order by fecha_pago desc, created_at desc
      `,
      [vecinoId],
    ),
  ]);

  const vecino = vecinos.find((item) => item.id === vecinoId);

  if (!vecino) {
    throw new AppError(404, "Dirección no encontrada.");
  }

  return {
    summary: buildVecinoFinancialSummary(vecino, totalsMap, configs),
    payments: paymentsResult.rows.map((item) => ({
      ...item,
      monto: Number(item.monto),
      equivalentQuotas:
        configs[item.concepto]?.valor_cuota
          ? roundQuotas(Number(item.monto) / Number(configs[item.concepto].valor_cuota))
          : 0,
    })),
  };
}

export async function getNeighborPortal(user) {
  const ledger = await getVecinoLedger(user.vecino_id);
  const [vecinos, configs, totalsMap] = await Promise.all([
    fetchVecinos(),
    fetchConfigs(),
    fetchPaymentTotals(),
  ]);
  const communityFinancials = vecinos.map((vecino) =>
    buildVecinoFinancialSummary(vecino, totalsMap, configs),
  );
  const community = buildCommunityComparison(communityFinancials);
  const sameStreetFinancials = communityFinancials.filter(
    (item) => item.pasaje === ledger.summary.pasaje,
  );
  const streetCommunity = buildCommunityComparison(sameStreetFinancials);

  let message = "Vas avanzando. Aún tienes pagos pendientes.";

  if (ledger.summary.generalStatus === "Al día" || ledger.summary.generalStatus === "Adelantado") {
    message = "Estás al día. Gracias por apoyar la seguridad del pasaje.";
  } else if (ledger.summary.generalStatus === "Atrasado") {
    message = "Registras pagos pendientes.";
  }

  return {
    ...ledger,
    comparison: {
      comunidadAlDia: community.vecinosAlDia,
      comunidadTotal: community.totalDirecciones,
      pasaje: ledger.summary.pasaje,
      pasajeAlDia: streetCommunity.vecinosAlDia,
      pasajeTotal: streetCommunity.totalDirecciones,
      resumenPortones: `${roundQuotas(ledger.summary.concepts.PORTONES.equivalentQuotas)} de ${ledger.summary.concepts.PORTONES.totalQuotas}`,
      resumenMantencion: `${roundQuotas(ledger.summary.concepts.MANTENCION.equivalentQuotas)} de ${ledger.summary.concepts.MANTENCION.totalQuotas}`,
      message,
    },
  };
}
