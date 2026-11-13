import { fileURLToPath } from "url";
import path from "path";
import { AppBundleSource } from "@holochain/client";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const ekoAppBundleSource: AppBundleSource = {
  type: "path",
  value: path.join(__dirname, "../../workdir/eko.happ"),
};

export const ekoAppBundleSourceNoLengthLimits: AppBundleSource = {
  type: "path",
  value: path.join(__dirname, "../../workdir-no-limits/eko.happ"),
};

// Helper to wrap inputs in ZomeFnInput format for the new API
export function wrapInput<T>(input: T, local: boolean = true): { input: T; local: boolean } {
  return { input, local };
}
