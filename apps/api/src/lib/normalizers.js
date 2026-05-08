const MONTH_INDEX = {
  Enero: 1,
  Febrero: 2,
  Marzo: 3,
  Abril: 4,
  Mayo: 5,
  Junio: 6,
  Julio: 7,
  Agosto: 8,
  Septiembre: 9,
  Octubre: 10,
  Noviembre: 11,
  Diciembre: 12,
};

export function normalizeWhitespace(value) {
  return `${value ?? ""}`.replace(/\s+/g, " ").trim();
}

export function normalizePasaje(value) {
  return normalizeWhitespace(value).toUpperCase();
}

export function normalizeDireccion(pasaje, numeracion, comuna = "Maipu", pais = "Chile") {
  return `${normalizePasaje(pasaje)} ${numeracion} ,${normalizeWhitespace(comuna)} ,${normalizeWhitespace(pais)}`;
}

export function normalizePhone(phone) {
  return `${phone ?? ""}`.replace(/\D/g, "");
}

export function last4Digits(phone) {
  const normalized = normalizePhone(phone);
  return normalized.slice(-4).padStart(4, "0");
}

export function normalizeConcept(concept) {
  const normalized = normalizeWhitespace(concept).toUpperCase();

  if (normalized === "PORTONES") {
    return "PORTONES";
  }

  if (normalized === "MANTENCION" || normalized === "MANTENCIÓN") {
    return "MANTENCION";
  }

  return normalized;
}

export function monthNameToIndex(name) {
  return MONTH_INDEX[name];
}

export function indexToMonthName(index) {
  return Object.entries(MONTH_INDEX).find(([, value]) => value === index)?.[0] ?? "";
}

export function parseBooleanFirma(value) {
  const normalized = normalizeWhitespace(value).toUpperCase();
  return normalized === "SI" || normalized === "SÍ" || normalized === "TRUE" || normalized === "1";
}

export function parseCurrency(value) {
  if (value === null || value === undefined || value === "") {
    return 0;
  }

  const numeric = Number(`${value}`.replace(/[^\d.-]/g, ""));
  return Number.isFinite(numeric) ? numeric : 0;
}

export function normalizeUsername(value) {
  return normalizeWhitespace(value).toLowerCase();
}

