import path from "node:path";
import { fileURLToPath } from "node:url";
import { importWorkbookToDatabase } from "../src/services/adminService.js";
import { env } from "../src/config/env.js";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const inputPath = process.argv[2] ?? path.join(rootDir, "Direcciones BD.xlsx");
const year = Number(process.argv[3] ?? env.importYear);
const sosMode = process.argv.includes("--sos");

const result = await importWorkbookToDatabase({
  actor: null,
  req: null,
  source: inputPath,
  year,
  sosMode,
});

console.log(JSON.stringify(result, null, 2));
