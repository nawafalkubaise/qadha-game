/**
 * يجلب روابط التحميل المباشرة من ويكيميديا كومنز ويحمّل إلى public/malls.
 * تشغيل من جذر المشروع: node scripts/fetch-mall-assets.mjs
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const outDir = path.join(root, "public", "malls");

/** اسم ملف محلي واضح ← عنوان ملف في كومنز (بدون بادئة File:) */
const MAP = [
  ["kuwait-avenues-entrance.jpg", "The Avenues Mall 1.jpg"],
  ["kuwait-souq-sharq-facade.jpg", "Kuwait City Souq Sharq 02.jpg"],
  ["kuwait-mall-360-zahra.jpg", "360 Mall in Kuwait City.jpg"],
  ["kuwait-mubarakiya-day.jpg", "Kuwait City Souq al-Mubarakeya 1.jpg"],
  ["kuwait-marina-mall-exterior.jpg", "The Marina Mall.jpg"],
  ["kuwait-al-kout-fahaheel.jpg", "Al kout mall, fahel,Kuwait.jpg"],
  ["kuwait-avenues-grand-avenue.jpg", "Grand Avenue in Kuwait - 2.jpg"],
  ["kuwait-marina-mall-salmiya.png", "Marina Mall - Salmiya.png"],
  ["kuwait-avenues-prestige.jpg", "Prestige the avenues mall of Kuwait.jpg"],
  ["kuwait-souq-sharq-marina-panorama.jpg", "Marina Souq Sharq, ciudad de Kuwait, Kuwait, 2024-08-12, DD 22-27 PAN.jpg"],
  ["kuwait-avenues-exterior-2007.jpg", "The Avenues Kuwait.jpg"],
  ["kuwait-marina-mall-bridge.jpg", "Marina Mall Bridge, Kuwait.jpg"],
  ["kuwait-avenues-grand-interior.jpg", "Grand avenus.jpg"],
  ["kuwait-mubarakiya-night.jpg", "Kuwait City Souq al-Mubarakeya at Night 01.jpg"],
];

async function commonsUrl(title) {
  const u = new URL("https://commons.wikimedia.org/w/api.php");
  u.searchParams.set("action", "query");
  u.searchParams.set("format", "json");
  u.searchParams.set("titles", "File:" + title);
  u.searchParams.set("prop", "imageinfo");
  u.searchParams.set("iiprop", "url");
  /** مقاسات مسموحة على خوادم ويكيميديا — انظر https://w.wiki/GHai */
  u.searchParams.set("iiurlwidth", "960");
  const r = await fetch(u, {
    headers: { "User-Agent": "qadha-game-mall-assets/1.0 (educational)" },
  });
  if (!r.ok) throw new Error(String(r.status));
  const j = await r.json();
  const pages = j.query?.pages || {};
  const p = Object.values(pages)[0];
  const ii = p?.imageinfo?.[0];
  const url = ii?.thumburl || ii?.url;
  if (!url) throw new Error("No URL for " + title);
  return url;
}

async function main() {
  fs.mkdirSync(outDir, { recursive: true });
  const lines = [];
  for (const [local, commonsTitle] of MAP) {
    const dest = path.join(outDir, local);
    if (fs.existsSync(dest) && fs.statSync(dest).size > 2048) {
      console.log(local, "(skip exists)", fs.statSync(dest).size);
      lines.push(`${local}\t${commonsTitle}\t(existing)`);
      continue;
    }
    const url = await commonsUrl(commonsTitle);
    await new Promise((r) => setTimeout(r, 1200));
    let bin;
    for (let attempt = 0; attempt < 6; attempt++) {
      bin = await fetch(url, {
        headers: { "User-Agent": "qadha-game-mall-assets/1.0 (educational-quiz)" },
      });
      if (bin.ok) break;
      if (bin.status === 429 && attempt < 5) {
        await new Promise((r) => setTimeout(r, 5000 + attempt * 4000));
        continue;
      }
      /** وثيقة HTML خطأ — غالباً حجم مصغرة غير مسموح */
      throw new Error(`GET ${bin.status} ${local}`);
    }
    fs.writeFileSync(dest, Buffer.from(await bin.arrayBuffer()));
    const st = fs.statSync(dest);
    console.log(local, st.size, "bytes");
    lines.push(`${local}\t${commonsTitle}\t${url}`);
  }
  fs.writeFileSync(path.join(outDir, "SOURCES.tsv"), lines.join("\n") + "\n", "utf8");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
