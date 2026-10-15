/**
 * تجربة مباراة كاملة: node playtest.mjs "<الدولة>" [--hard] [--mobile]
 * تلعب ٤٨ سؤالاً وتسجّل أي خطأ (أخطاء المتصفح، أسئلة/خيارات مكررة أو فارغة، تجاوز عرض الشاشة، نتيجة، «ثاني»).
 */
import { chromium } from "playwright-core";
import fs from "fs";
const country = process.argv[2] || "الكويت";
const hardMode = process.argv.includes("--hard");
const mobile = process.argv.includes("--mobile");
const shotDir = new URL("./shots/", import.meta.url).pathname.replace(/^\/([A-Z]:)/, "$1");
fs.mkdirSync(shotDir, { recursive: true });
const tag = `${country}${hardMode ? "_hard" : ""}${mobile ? "_m" : ""}`.replace(/\s+/g, "_");
const browser = await chromium.launch({ channel: "chrome", headless: true });
const ctx = await browser.newContext(mobile ? { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true } : { viewport: { width: 1100, height: 1000 } });
const p = await ctx.newPage();
const issues = [];
const note = (m) => { issues.push(m); console.log("  ⚠️ " + m); };
p.on("dialog", (d) => { note("DIALOG: " + d.message()); d.dismiss(); });
p.on("pageerror", (e) => note("PAGEERROR: " + e.message));
p.on("console", (m) => { if (m.type() === "error" && !/flagcdn|favicon|Failed to load resource/.test(m.text())) note("CONSOLE: " + m.text().slice(0, 200)); });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const onGrid = () => p.$(".grid-header-row").then(Boolean);
const atResults = async () => (await p.getByRole("button", { name: "ثاني", exact: true }).count()) > 0;
const scores = () => p.evaluate(() => { const r = document.querySelector(".grid-header-row"); if (!r) return null; const d = [...r.children]; return [d[0], d[2]].map((x) => Number((x.innerText.match(/\d+/g) || []).slice(-1)[0])); });
const timerVal = () => p.evaluate(() => Number([...document.querySelectorAll("div")].find((d) => getComputedStyle(d).borderRadius === "50%" && /^[0-9]+$/.test(d.innerText.trim()))?.innerText));
const hScroll = async (where) => { const o = await p.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth); if (o > 2) note(`horizontal overflow ${o}px on ${where}`); };
const norm = (s) => String(s).replace(/[ً-ٰٟـ]/g, "").replace(/\s+/g, " ").trim();

await p.goto("http://localhost:5173/");
await p.getByRole("button", { name: "يلا", exact: true }).click({ timeout: 15000 });
await p.getByRole("button", { name: new RegExp(country) }).first().click();
await sleep(400);
let picked = 0;
for (let t = 0; picked < 8 && t < 12; t++) {
  const tabs = p.locator(".catGroupTab"); if (t < await tabs.count()) await tabs.nth(t).click();
  const cards = p.locator(".catsCard:not(.catsCardLocked)"); const n = await cards.count();
  for (let i = 0; i < n && picked < 8; i++) { await cards.nth(i).dispatchEvent("pointerdown"); picked++; await sleep(40); }
}
await p.getByText("التالي — إعداد الفريق").click();
await sleep(300);
const y = await p.evaluate(() => scrollY); if (y > 5) note(`setup screen opened scrolled down (${y}px)`);
const inps = p.locator(".inp"); await inps.nth(0).fill("تجربة"); await inps.nth(1).fill("أحمد"); await inps.nth(2).fill("سارة");
if (hardMode) await p.getByRole("button", { name: "صعب 🔥" }).click();
await p.getByRole("button", { name: "يلا!", exact: true }).click();
await p.waitForSelector(".grid-header-row", { timeout: 30000 });
await hScroll("grid");
const off = await p.evaluate(() => [...document.querySelectorAll("button.gcl")].filter((b) => { const r = b.getBoundingClientRect(); return r.left < 0 || r.right > innerWidth; }).length);
if (off) note(`${off} board cells off-screen`);
await p.screenshot({ path: `${shotDir}grid_${tag}.png`, fullPage: true });
console.log(`game started: ${tag}`);

const seen = new Set(); let qCount = 0, turns = 0, maxBonus = 0;
const tested = new Set();
while (turns++ < 300 && !(await atResults())) {
  if (await onGrid()) {
    const sc = await scores(); if (sc && (sc[0] < 0 || sc[1] < 0)) note("negative score " + sc);
    const cells = p.locator("button.gcl"); const n = await cells.count();
    if (!n) { await sleep(800); continue; }
    await cells.nth(Math.floor(Math.random() * n)).click({ timeout: 5000 }).catch((e) => note("cell click failed: " + e.message.split("\n")[0]));
    await sleep(500);
    const dd = p.locator("div[style*='position: fixed'] button", { hasText: "يلا!" });
    if (await dd.count()) { await dd.first().click(); await sleep(300); }
    continue;
  }
  const qText = await p.evaluate(() => document.querySelector(".gc p")?.innerText || "");
  if (!qText) { await sleep(400); continue; }
  const key = norm(qText);
  if (!seen.has(key)) {
    seen.add(key); qCount++;
    if (qCount === 3) await p.screenshot({ path: `${shotDir}question_${tag}.png`, fullPage: true });
    const opts = await p.locator("button.ob").allInnerTexts();
    const clean = opts.map((o) => norm(o.replace(/^[ABCD]\s*/, "")));
    const len = qText.length + clean.join("").length;
    const t0 = await timerVal(); if (len > 300) maxBonus = Math.max(maxBonus, t0);
    if (qText === "?" || /placeholder|خيار دقيق|precise option/i.test(qText + clean.join())) note("placeholder question: " + qText);
    if (!hardMode && clean.length && clean.length !== 4) note(`options count ${clean.length}: ${qText}`);
    if (!hardMode && new Set(clean).size !== clean.length) note("duplicate options shown: " + qText);
    if (!hardMode && clean.some((o) => !o)) note("empty option: " + qText);
    if (!hardMode && !tested.has("fifty")) { tested.add("fifty"); await p.getByRole("button", { name: "٥٠/٥٠" }).click(); await sleep(300); const left = await p.locator("button.ob").count(); if (left !== 2) note("50/50 left " + left); }
    else if (!tested.has("ext")) { tested.add("ext"); const a = await timerVal(); await p.getByRole("button", { name: "+١٥ث" }).click(); await sleep(250); const b = await timerVal(); if (!(b >= a + 13)) note(`+15s ${a}->${b}`); }
    else if (!tested.has("switch")) { tested.add("switch"); await p.getByRole("button", { name: "🔄 تبديل" }).click(); await sleep(400); const q2 = await p.evaluate(() => document.querySelector(".gc p")?.innerText || ""); if (q2 === qText) note("switch did not change question"); else seen.add(norm(q2)); }
  }
  if (hardMode) {
    const inp = p.getByPlaceholder("اكتب إجابتك هنا...");
    if (await inp.isEnabled().catch(() => false)) { await inp.fill("جواب"); await inp.press("Enter"); }
  } else {
    const live = p.locator("button.ob"); const n = await live.count();
    if (n) await live.nth(Math.floor(Math.random() * n)).click({ timeout: 5000 }).catch(() => {});
  }
  await sleep(2600);
}
const end = await atResults();
console.log(`questions=${qCount} turns=${turns} results=${end} longQuestionStartTimerMax=${maxBonus}`);
if (!end) note("did not reach results");
else {
  await hScroll("results"); await p.screenshot({ path: `${shotDir}results_${tag}.png`, fullPage: true });
  const title = await p.evaluate(() => document.querySelector("h1.tl")?.innerText || "");
  if (/الفريق/.test(title)) note("1v1 results says الفريق: " + title);
  await p.getByRole("button", { name: "ثاني", exact: true }).click();
  await p.waitForSelector(".grid-header-row", { timeout: 30000 });
  const sc = await scores(); const unused = await p.locator("button.gcl").count();
  console.log(`rematch: scores=${sc} cells=${unused}`);
  if (sc[0] || sc[1]) note("rematch scores not reset");
  if (unused < 46) note("rematch board not fresh: " + unused);
}
console.log(`RESULT ${tag}: ${issues.length} issue(s)`);
await browser.close();
