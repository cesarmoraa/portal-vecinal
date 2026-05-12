export function formatCurrency(value) {
  return new Intl.NumberFormat("es-CL", {
    style: "currency",
    currency: "CLP",
    maximumFractionDigits: 0,
  }).format(Number(value ?? 0));
}

export function formatPercent(value) {
  return `${Number(value ?? 0).toFixed(1)}%`;
}

export function formatDate(value) {
  if (!value) {
    return "Sin fecha";
  }

  let date;

  if (typeof value === "string") {
    const match = value.match(/^(\d{4})-(\d{2})-(\d{2})/);

    if (match) {
      date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
    }
  }

  if (!date) {
    date = new Date(value);
  }

  return new Intl.DateTimeFormat("es-CL", {
    dateStyle: "medium",
  }).format(date);
}

export function formatQuotas(value) {
  return Number(value ?? 0).toLocaleString("es-CL", {
    minimumFractionDigits: Number.isInteger(Number(value)) ? 0 : 1,
    maximumFractionDigits: 2,
  });
}

export function formatConceptLabel(value) {
  return `${value ?? ""}`
    .replace(/[_-]+/g, " ")
    .trim()
    .split(/\s+/)
    .map((word) => {
      const normalized = word.toUpperCase();

      if (normalized === "MANTENCION" || normalized === "MANTENCIÓN") {
        return "Mantención";
      }

      if (!word) {
        return "";
      }

      if (/^\d+$/.test(word)) {
        return word;
      }

      return `${word.charAt(0).toUpperCase()}${word.slice(1).toLowerCase()}`;
    })
    .join(" ");
}
