import { spawnSync } from "node:child_process";

const RUNS = 20;

for (let i = 1; i <= RUNS; i++) {
  console.log(`\n[questions-guard] run ${i}/${RUNS}`);
  const res = process.platform === "win32"
    ? spawnSync("cmd", ["/d", "/s", "/c", "npm run questions:guard"], { stdio: "inherit" })
    : spawnSync("npm", ["run", "questions:guard"], { stdio: "inherit" });
  if (res.status !== 0) {
    console.error(`[questions-guard] failed at run ${i}/${RUNS}`);
    process.exit(res.status || 1);
  }
}

console.log(`\n[questions-guard] all ${RUNS} runs passed.`);
