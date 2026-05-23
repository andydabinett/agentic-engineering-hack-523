import path from "path";
import { pathToFileURL } from "url";

import { ROOT } from "../config/env.js";

let registered = false;

/** Register tsx so Node can load repo-root .ts (parameter properties, etc.) from Next. */
export async function registerTsLoader() {
  if (registered) return;
  const tsxApi = pathToFileURL(
    path.join(ROOT, "node_modules/tsx/dist/esm/api/index.mjs"),
  ).href;
  const { register } = await import(tsxApi);
  register();
  registered = true;
}

export function importFromRoot(relPath) {
  const abs = path.join(ROOT, relPath);
  return import(pathToFileURL(abs).href);
}
