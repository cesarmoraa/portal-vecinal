import path from "node:path";
import { fileURLToPath } from "node:url";
import { exportDatabaseToWorkbook } from "../src/services/adminService.js";
import { env } from "../src/config/env.js";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const year = Number(process.argv[2] ?? env.exportYear);
const outputPath =
  process.argv[3] ?? path.join(rootDir, "exports", `comunidad-export-${year}.xlsx`);

await exportDatabaseToWorkbook({
  actor: null,
  req: null,
  year,
  outputPath,
});

console.log(`Excel exportado en ${outputPath}`);
