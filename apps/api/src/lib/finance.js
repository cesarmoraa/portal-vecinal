export function roundCurrency(value) {
  return Math.round((Number(value) + Number.EPSILON) * 100) / 100;
}

export function roundQuotas(value) {
  return Math.round((Number(value) + Number.EPSILON) * 100) / 100;
}

export function getExpectedQuotaCount(config, today = new Date()) {
  if (!config || !config.activo) {
    return 0;
  }

  const targetYear = Number(config.anio);
  const startMonth = Number(config.mes_inicio ?? 1);
  const currentYear = today.getFullYear();
  const currentMonth = today.getMonth() + 1;

  if (currentYear < targetYear) {
    return 0;
  }

  if (currentYear > targetYear) {
    return Number(config.cuotas_totales);
  }

  return Math.max(
    0,
    Math.min(Number(config.cuotas_totales), currentMonth - startMonth + 1),
  );
}

export function computeConceptProgress(totalPaid, config, today = new Date()) {
  if (!config) {
    return {
      concepto: null,
      totalPaid: 0,
      totalQuotas: 0,
      valorCuota: 0,
      equivalentQuotas: 0,
      expectedQuotas: 0,
      totalProgrammed: 0,
      expectedAmount: 0,
      pendingAmount: 0,
      progressPercentage: 0,
      status: "Sin datos",
    };
  }

  const paid = roundCurrency(totalPaid);
  const valueQuota = Number(config.valor_cuota);
  const totalQuotas = Number(config.cuotas_totales);
  const totalProgrammed = roundCurrency(Number(config.cuotas_totales) * valueQuota);
  const expectedQuotas = getExpectedQuotaCount(config, today);
  const expectedAmount = roundCurrency(expectedQuotas * valueQuota);
  const equivalentQuotas = roundQuotas(paid / valueQuota);
  const pendingAmount = roundCurrency(Math.max(totalProgrammed - paid, 0));
  const progressPercentage = totalProgrammed === 0 ? 0 : roundQuotas((paid / totalProgrammed) * 100);

  let status = "Atrasado";

  if (paid <= 0 && expectedQuotas === 0) {
    status = "Parcial";
  } else if (equivalentQuotas >= expectedQuotas + 0.01) {
    status = "Adelantado";
  } else if (equivalentQuotas >= expectedQuotas - 0.01) {
    status = "Al día";
  } else if (equivalentQuotas > 0) {
    status = "Parcial";
  }

  return {
    concepto: config.concepto,
    totalPaid: paid,
    totalQuotas,
    valorCuota: valueQuota,
    equivalentQuotas,
    expectedQuotas,
    totalProgrammed,
    expectedAmount,
    pendingAmount,
    progressPercentage,
    status,
  };
}

export function computeGeneralStatus({ hasSignature, concepts }) {
  if (!hasSignature) {
    return "Sin firma";
  }

  const statuses = concepts.map((item) => item.status);

  if (statuses.every((status) => status === "Al día")) {
    return "Al día";
  }

  if (statuses.some((status) => status === "Atrasado")) {
    return "Atrasado";
  }

  if (statuses.some((status) => status === "Adelantado")) {
    return statuses.every((status) => status === "Adelantado" || status === "Al día")
      ? "Adelantado"
      : "Parcial";
  }

  return "Parcial";
}

export function formatMarkerLabel(portones, mantencion) {
  const left = Number.isInteger(portones) ? `${portones}` : portones.toFixed(1);
  const right = Number.isInteger(mantencion) ? `${mantencion}` : mantencion.toFixed(1);
  return `${left}/${right}`;
}
