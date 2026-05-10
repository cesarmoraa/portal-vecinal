import ExcelJS from "exceljs";
import fs from "node:fs/promises";
import path from "node:path";
import { AppError } from "./appError.js";
import {
  indexToMonthName,
  last4Digits,
  monthNameToIndex,
  normalizeConcept,
  normalizeDireccion,
  normalizePasaje,
  normalizePhone,
  parseBooleanFirma,
  parseCurrency,
} from "./normalizers.js";

const REQUIRED_SHEETS = ["BD", "Resumen", "$Portones", "$Mantenciones"];
const MONTH_NAMES = [
  "Enero",
  "Febrero",
  "Marzo",
  "Abril",
  "Mayo",
  "Junio",
  "Julio",
  "Agosto",
  "Septiembre",
  "Octubre",
  "Noviembre",
  "Diciembre",
];

function unwrapCellValue(value) {
  if (value === null || value === undefined) {
    return value;
  }

  if (value instanceof Date) {
    return value;
  }

  if (typeof value !== "object") {
    return value;
  }

  if ("result" in value && value.result !== undefined && value.result !== null) {
    return unwrapCellValue(value.result);
  }

  if ("error" in value && value.error) {
    return null;
  }

  if (Array.isArray(value.richText)) {
    return value.richText.map((part) => part.text ?? "").join("");
  }

  if ("text" in value && value.text !== undefined && value.text !== null) {
    return value.text;
  }

  if ("hyperlink" in value && value.hyperlink) {
    return value.text ?? value.hyperlink;
  }

  if ("formula" in value) {
    return null;
  }

  return value;
}

function getSheet(workbook, name) {
  const sheet = workbook.getWorksheet(name);

  if (!sheet) {
    throw new AppError(400, `La hoja "${name}" no existe en el Excel.`);
  }

  return sheet;
}

function readHeaders(sheet) {
  return sheet
    .getRow(1)
    .values
    .slice(1)
    .map((value) => `${value ?? ""}`.trim());
}

function requireHeaders(sheet, expectedHeaders) {
  const headers = readHeaders(sheet);

  for (const header of expectedHeaders) {
    if (!headers.includes(header)) {
      throw new AppError(400, `La hoja "${sheet.name}" no contiene la columna "${header}".`);
    }
  }

  const indexes = {};
  headers.forEach((header, index) => {
    indexes[header] = index + 1;
  });

  return indexes;
}

function buildVecinoKey(pasaje, numeracion) {
  return `${normalizePasaje(pasaje)}::${Number(numeracion)}`;
}

function readCell(row, indexes, header) {
  return unwrapCellValue(row.getCell(indexes[header]).value);
}

function sheetRowCount(sheet) {
  return sheet.actualRowCount ?? sheet.rowCount;
}

export async function loadWorkbook(input) {
  const workbook = new ExcelJS.Workbook();

  if (Buffer.isBuffer(input)) {
    await workbook.xlsx.load(input);
    return workbook;
  }

  const absolutePath = path.resolve(input);
  const file = await fs.readFile(absolutePath);
  await workbook.xlsx.load(file);
  return workbook;
}

export async function parseExcelWorkbook(input, year) {
  const workbook = await loadWorkbook(input);

  for (const sheetName of REQUIRED_SHEETS) {
    getSheet(workbook, sheetName);
  }

  const bdSheet = getSheet(workbook, "BD");
  const resumenSheet = getSheet(workbook, "Resumen");
  const portonesSheet = getSheet(workbook, "$Portones");
  const mantencionesSheet = getSheet(workbook, "$Mantenciones");

  const bdIndexes = requireHeaders(bdSheet, [
    "Pasaje",
    "Numeracion",
    "Comuna",
    "Pais",
    "Direccion",
    "Coordenadas",
    "Latitud",
    "Longitud",
    "Nombre",
    "Telefono",
  ]);
  const resumenIndexes = requireHeaders(resumenSheet, [
    "Pasaje",
    "Numeracion",
    "Firma VºBº",
    "Cuota Portones",
    "Cuota Mantención",
  ]);
  const monthlyIndexes = requireHeaders(portonesSheet, [
    "Pasaje",
    "Numeracion",
    ...MONTH_NAMES,
    "Total",
  ]);
  requireHeaders(mantencionesSheet, ["Pasaje", "Numeracion", ...MONTH_NAMES, "Total"]);

  const vecinosMap = new Map();
  const duplicates = [];

  for (let rowNumber = 2; rowNumber <= sheetRowCount(bdSheet); rowNumber += 1) {
    const row = bdSheet.getRow(rowNumber);
    const pasaje = readCell(row, bdIndexes, "Pasaje");
    const numeracion = readCell(row, bdIndexes, "Numeracion");

    if (!pasaje || !numeracion) {
      continue;
    }

    const key = buildVecinoKey(pasaje, numeracion);

    if (vecinosMap.has(key)) {
      duplicates.push({ sheet: "BD", row: rowNumber, key });
      continue;
    }

    const comuna = `${readCell(row, bdIndexes, "Comuna") ?? "Maipu"}`.trim();
    const pais = `${readCell(row, bdIndexes, "Pais") ?? "Chile"}`.trim();

    vecinosMap.set(key, {
      pasaje: normalizePasaje(pasaje),
      numeracion: Number(numeracion),
      comuna,
      pais,
      direccion:
        `${readCell(row, bdIndexes, "Direccion") ?? ""}`.trim() ||
        normalizeDireccion(pasaje, numeracion, comuna, pais),
      coordenadas: `${readCell(row, bdIndexes, "Coordenadas") ?? ""}`.trim() || null,
      latitud: Number(readCell(row, bdIndexes, "Latitud")) || null,
      longitud: Number(readCell(row, bdIndexes, "Longitud")) || null,
      representanteNombre: `${readCell(row, bdIndexes, "Nombre") ?? ""}`.trim() || "Sin representante",
      telefono: normalizePhone(readCell(row, bdIndexes, "Telefono")),
      firmaVobo: false,
      cuotaPortonesInicial: 0,
      cuotaMantencionInicial: 0,
    });
  }

  for (let rowNumber = 2; rowNumber <= sheetRowCount(resumenSheet); rowNumber += 1) {
    const row = resumenSheet.getRow(rowNumber);
    const pasaje = readCell(row, resumenIndexes, "Pasaje");
    const numeracion = readCell(row, resumenIndexes, "Numeracion");

    if (!pasaje || !numeracion) {
      continue;
    }

    const key = buildVecinoKey(pasaje, numeracion);
    const vecino = vecinosMap.get(key);

    if (!vecino) {
      continue;
    }

    vecino.firmaVobo = parseBooleanFirma(readCell(row, resumenIndexes, "Firma VºBº"));
    vecino.cuotaPortonesInicial = Number(readCell(row, resumenIndexes, "Cuota Portones")) || 0;
    vecino.cuotaMantencionInicial =
      Number(readCell(row, resumenIndexes, "Cuota Mantención")) || 0;
  }

  const payments = [];

  for (const [sheetName, conceptName] of [
    ["$Portones", "PORTONES"],
    ["$Mantenciones", "MANTENCION"],
  ]) {
    const sheet = getSheet(workbook, sheetName);

    for (let rowNumber = 2; rowNumber <= sheetRowCount(sheet); rowNumber += 1) {
      const row = sheet.getRow(rowNumber);
      const pasaje = readCell(row, monthlyIndexes, "Pasaje");
      const numeracion = readCell(row, monthlyIndexes, "Numeracion");

      if (!pasaje || !numeracion) {
        continue;
      }

      const key = buildVecinoKey(pasaje, numeracion);

      if (!vecinosMap.has(key)) {
        continue;
      }

      for (const monthName of MONTH_NAMES) {
        const amount = parseCurrency(readCell(row, monthlyIndexes, monthName));

        if (amount <= 0) {
          continue;
        }

        const monthIndex = monthNameToIndex(monthName);
        payments.push({
          vecinoKey: key,
          concepto: normalizeConcept(conceptName),
          monto: amount,
          fechaPago: new Date(Date.UTC(year, monthIndex - 1, 5)).toISOString().slice(0, 10),
          periodYear: year,
          periodMonth: monthIndex,
          observacion: `Importado desde ${sheetName} (${monthName} ${year})`,
          source: "excel",
          sourceRef: `${conceptName}:${year}:${String(monthIndex).padStart(2, "0")}`,
        });
      }
    }
  }

  if (duplicates.length > 0) {
    throw new AppError(400, "Se detectaron direcciones duplicadas en el Excel.", duplicates);
  }

  return {
    vecinos: Array.from(vecinosMap.values()),
    payments,
  };
}

function addHeaderRow(sheet, headers) {
  const row = sheet.addRow(headers);
  row.font = { bold: true };
  row.eachCell((cell) => {
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FF0E2A47" },
    };
    cell.font = { bold: true, color: { argb: "FFF6F7FB" } };
  });
}

export async function buildExportWorkbook({ financials, paymentsByVecino, year }) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Codex";
  workbook.created = new Date();

  const bdSheet = workbook.addWorksheet("BD");
  const resumenSheet = workbook.addWorksheet("Resumen");
  const portonesSheet = workbook.addWorksheet("$Portones");
  const mantencionesSheet = workbook.addWorksheet("$Mantenciones");

  addHeaderRow(bdSheet, [
    "Pasaje",
    "Numeracion",
    "Comuna",
    "Pais",
    "Direccion",
    "Coordenadas",
    "Latitud",
    "Longitud",
    "Nombre",
    "Telefono",
    "Contraseña",
  ]);
  addHeaderRow(resumenSheet, [
    "Pasaje",
    "Numeracion",
    "Comuna",
    "Pais",
    "Direccion",
    "Coordenadas",
    "Latitud",
    "Longitud",
    "Firma VºBº",
    "Cuota Portones",
    "Cuota Mantención",
  ]);
  addHeaderRow(portonesSheet, [
    "Pasaje",
    "Numeracion",
    "Comuna",
    "Pais",
    "Direccion",
    "Coordenadas",
    "Latitud",
    "Longitud",
    ...MONTH_NAMES,
    "Total",
  ]);
  addHeaderRow(mantencionesSheet, [
    "Pasaje",
    "Numeracion",
    "Comuna",
    "Pais",
    "Direccion",
    "Coordenadas",
    "Latitud",
    "Longitud",
    ...MONTH_NAMES,
    "Total",
  ]);

  for (const item of financials) {
    bdSheet.addRow([
      item.pasaje,
      item.numeracion,
      item.comuna ?? "Maipu",
      item.pais ?? "Chile",
      item.direccion,
      item.coordenadas ?? "",
      item.latitud,
      item.longitud,
      item.representanteNombre,
      item.telefono,
      "",
    ]);

    resumenSheet.addRow([
      item.pasaje,
      item.numeracion,
      item.comuna ?? "Maipu",
      item.pais ?? "Chile",
      item.direccion,
      item.coordenadas ?? "",
      item.latitud,
      item.longitud,
      item.firmaVobo ? "SI" : "NO",
      item.concepts.PORTONES.equivalentQuotas,
      item.concepts.MANTENCION.equivalentQuotas,
    ]);

    for (const concept of ["PORTONES", "MANTENCION"]) {
      const monthlyValues = new Array(12).fill(null);
      const payments = paymentsByVecino[item.vecinoId]?.[concept] ?? [];
      let nonMonthlyTotal = 0;

      for (const payment of payments) {
        if (payment.periodYear === year && payment.periodMonth >= 1 && payment.periodMonth <= 12) {
          monthlyValues[payment.periodMonth - 1] =
            (monthlyValues[payment.periodMonth - 1] ?? 0) + Number(payment.monto);
          continue;
        }

        nonMonthlyTotal += Number(payment.monto);
      }

      const targetSheet = concept === "PORTONES" ? portonesSheet : mantencionesSheet;
      const rowTotal =
        monthlyValues.reduce((sum, value) => sum + Number(value ?? 0), 0) + nonMonthlyTotal;
      const newRow = targetSheet.addRow([
        item.pasaje,
        item.numeracion,
        item.comuna ?? "Maipu",
        item.pais ?? "Chile",
        item.direccion,
        item.coordenadas ?? "",
        item.latitud,
        item.longitud,
        ...monthlyValues,
        rowTotal,
      ]);

      newRow.getCell(21).value = rowTotal;
    }
  }

  for (const sheet of [bdSheet, resumenSheet, portonesSheet, mantencionesSheet]) {
    sheet.columns.forEach((column) => {
      column.width = 18;
    });
  }

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}

export async function buildExecutiveOverviewWorkbook({ financials, year }) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Codex";
  workbook.created = new Date();

  const sheet = workbook.addWorksheet(`Vista general ${year}`);

  addHeaderRow(sheet, [
    "Direccion",
    "Nombre",
    "Pasaje",
    "Firma VºBº",
    "Cuota Portones",
    "Cuota Mantención",
  ]);

  for (const item of financials) {
    sheet.addRow([
      `${item.pasaje} ${item.numeracion}`,
      item.representanteNombre || "Sin representante",
      item.pasaje,
      item.firmaVobo ? "SI" : "NO",
      `${item.concepts.PORTONES.equivalentQuotas} de ${item.concepts.PORTONES.totalQuotas}`,
      `${item.concepts.MANTENCION.equivalentQuotas} de ${item.concepts.MANTENCION.totalQuotas}`,
    ]);
  }

  sheet.columns = [
    { key: "direccion", width: 26 },
    { key: "nombre", width: 34 },
    { key: "pasaje", width: 24 },
    { key: "firma", width: 14 },
    { key: "portones", width: 18 },
    { key: "mantencion", width: 20 },
  ];

  sheet.views = [{ state: "frozen", ySplit: 1 }];

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}

export function buildInitialNeighborUser(vecino, hash) {
  return {
    role: "vecino",
    username: `${vecino.pasaje} ${vecino.numeracion}`.trim(),
    pasaje: vecino.pasaje,
    numeracion: vecino.numeracion,
    fullName: vecino.representanteNombre,
    phone: vecino.telefono,
    pinHash: hash,
    mustChangePassword: true,
    initialPin: last4Digits(vecino.telefono),
  };
}

export function groupPaymentsByVecino(payments) {
  return payments.reduce((acc, payment) => {
    if (!acc[payment.vecino_id]) {
      acc[payment.vecino_id] = {
        PORTONES: [],
        MANTENCION: [],
      };
    }

    acc[payment.vecino_id][payment.concepto].push({
      monto: Number(payment.monto),
      periodYear: payment.period_year,
      periodMonth: payment.period_month,
      fechaPago: payment.fecha_pago,
    });
    return acc;
  }, {});
}

export { MONTH_NAMES, indexToMonthName };
