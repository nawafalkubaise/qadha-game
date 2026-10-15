/** تجربة أونلاين بجهازين: المضيف (لاعب ١) والضيف (لاعب ٢) */
import { chromium } from "playwright-core";
const browser = await chromium.launch({ channel: "chrome", headless: true });
const issues = [];
const mk = async (tag) => { const c = await browser.newContext({ viewport: { width: 900, height: 1100 } }); const p = await c.newPage();
  p.on("dialog", (d) => { issues.push(tag + " DIALOG " + d.message()); d.dismiss(); });
  p.on("pageerror", (e) => issues.push(tag + " PAGEERROR " + e.message)); return p; };
const host = await mk("HOST"), guest = await mk("GUEST");
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const txt = (p) => p.evaluate(() => document.body.innerText);
const scores = (p) => p.evaluate(() => { const r = document.querySelector(".grid-header-row"); if (!r) return null; const d = [...r.children]; return [d[0], d[2]].map((x) => Number((x.innerText.match(/\d+/g) || []).slice(-1)[0])); });
const btn = (p, t) => p.getByRole("button", { name: t, exact: true });
try {
  for (const p of [host, guest]) { await p.goto("http://localhost:5173/"); await p.getByText("اللعب الجماعي عبر الشبكة").click({ timeout: 15000 }); }
  await btn(host, "إنشاء غرفة").last().click();
  await host.waitForFunction(() => /\b[A-Z2-9]{6}\b/.test(document.body.innerText));
  const code = (await txt(host)).match(/\b[A-Z2-9]{6}\b/)[0];
  await btn(guest, "الدخول").click(); await guest.getByPlaceholder("اسمك").fill("ضيف"); await guest.getByPlaceholder("كود الغرفة").fill(code); await btn(guest, "دخول").click();
  await btn(guest, "متابعة").click({ timeout: 10000 });
  await host.waitForFunction(() => document.body.innerText.includes("ضيف"), null, { timeout: 10000 });
  await btn(host, "متابعة").click();
  let picked = 0;
  for (let t = 0; picked < 8 && t < 12; t++) {
    const tabs = host.locator(".catGroupTab"); if (t < await tabs.count()) await tabs.nth(t).click();
    const cards = host.locator(".catsCard:not(.catsCardLocked)"); const n = await cards.count();
    for (let i = 0; i < n && picked < 8; i++) { await cards.nth(i).dispatchEvent("pointerdown"); picked++; await sleep(60); }
  }
  await host.getByText("التالي — إعداد الفريق").click();
  await guest.waitForFunction(() => document.body.innerText.includes("بانتظار المضيف"), null, { timeout: 10000 });
  const inps = host.locator(".inp"); await inps.nth(0).fill("مباراة"); await inps.nth(1).fill("مضيف"); await inps.nth(2).fill("الضيف");
  await btn(host, "يلا!").click();
  await host.waitForSelector(".grid-header-row", { timeout: 30000 }); await guest.waitForSelector(".grid-header-row", { timeout: 30000 });
  let guestAnswered = false, guestPicked = false, guestSwitched = false;
  for (let round = 0; round < 10 && !(guestAnswered && guestPicked); round++) {
    const active = /الضيف\s*يلعب/.test(await txt(host)) ? 2 : 1;
    const picker = active === 1 ? host : guest;
    const cells = picker.locator("button.gcl");
    await cells.nth(Math.floor(Math.random() * Math.min(6, await cells.count()))).click();
    if (active === 2) guestPicked = true;
    await sleep(900);
    for (const p of [host, guest]) { const b = p.locator("div[style*='position: fixed'] button", { hasText: "يلا!" }); if (await b.count()) await b.first().click(); }
    await host.waitForFunction(() => !document.querySelector(".grid-header-row"), null, { timeout: 8000 });
    await guest.waitForFunction(() => !document.querySelector(".grid-header-row"), null, { timeout: 8000 });
    const hq = await host.evaluate(() => document.querySelector(".gc p")?.innerText), gq = await guest.evaluate(() => document.querySelector(".gc p")?.innerText);
    if (hq !== gq) issues.push(`round ${round}: different question on host/guest`);
    for (let step = 0; step < 2; step++) {
      await sleep(800);
      if (await host.$(".grid-header-row")) break;
      const who = /الضيف\s*يلعب/.test(await txt(host)) ? guest : host;
      if (who === guest && !guestSwitched) {
        guestSwitched = true; const before = await host.evaluate(() => document.querySelector(".gc p")?.innerText);
        await guest.getByRole("button", { name: "🔄 تبديل" }).click().catch(() => {}); await sleep(1200);
        const after = await host.evaluate(() => document.querySelector(".gc p")?.innerText);
        const g2 = await guest.evaluate(() => document.querySelector(".gc p")?.innerText);
        if (after === before) issues.push("guest switch did not change question");
        if (g2 !== after) issues.push("guest did not receive switched question");
      }
      const opts = who.locator("button.ob"); if (!(await opts.count())) { await sleep(1500); continue; }
      await opts.nth(Math.floor(Math.random() * await opts.count())).click();
      if (who === guest) guestAnswered = true;
      await sleep(2600);
    }
    await host.waitForSelector(".grid-header-row", { timeout: 12000 }); await guest.waitForSelector(".grid-header-row", { timeout: 12000 });
    await sleep(700);
    const hs = await scores(host), gs = await scores(guest);
    if (JSON.stringify(hs) !== JSON.stringify(gs)) issues.push(`round ${round}: scores differ host ${hs} guest ${gs}`);
  }
  console.log(`guestPicked=${guestPicked} guestAnswered=${guestAnswered} guestSwitched=${guestSwitched}`);
  if (!guestPicked || !guestAnswered) issues.push("guest never got to play");
} catch (e) { issues.push("FAIL " + e.message.split("\n")[0]); }
console.log(issues.length ? issues.join("\n") : "ONLINE: 0 issues");
await browser.close();
