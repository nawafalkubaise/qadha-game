/**
 * يفعّل مجلد githooks/ لهذا المستودع فقط (خطاف post-commit = push تلقائي).
 * يُستدعى من npm run prepare بعد npm install.
 */
import { execSync } from "node:child_process";
import path from "path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");

try {
  execSync("git rev-parse --git-dir", { cwd: root, stdio: "pipe" });
} catch {
  process.exit(0);
}

try {
  execSync("git config core.hooksPath githooks", { cwd: root, stdio: "inherit" });
  console.log("[prepare] core.hooksPath = githooks (رفع تلقائي بعد كل git commit)");
} catch {
  process.exit(0);
}
