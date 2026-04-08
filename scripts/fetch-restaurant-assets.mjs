/**
 * يجلب صور مطاعم/أماكن مأكولات من كومنز (Kuwait) إلى public/restaurants.
 * تشغيل من جذر المشروع: node scripts/fetch-restaurant-assets.mjs
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const outDir = path.join(root, "public", "restaurants");

const MAP = [
  ["kuwait-rest-kfc-1980.jpg", "KFC restaurant Kuwait City, 1980.jpg"],
  ["kuwait-rest-mcdonalds.jpg", "Mcdonald's.jpg"],
  ["kuwait-rest-chilis.jpg", "Chilis Kuwait.jpg"],
  ["kuwait-rest-hardeez.jpg", "Hardeez Kuwait.jpg"],
  ["kuwait-rest-burger-king.jpg", "Burgerking1.jpg"],
  ["kuwait-rest-shrimpy.jpg", "Shrimpy in Jabriya.jpg"],
  ["kuwait-rest-mughal-mahal.jpg", "Mughal mahal.jpg"],
  ["kuwait-rest-hard-rock.jpg", "Hrc-kuwait.jpg"],
  ["kuwait-rest-chocolate-bar.jpg", "The Chocolate Bar - Yum!.jpg"],
  ["kuwait-rest-shamam-oven.jpg", "Al Shamam Restaurant Oven in Mubarakiya.jpg"],
  ["kuwait-rest-mubarakiya-cafes.jpg", "Traditional cafes in Mubarakiya.jpg"],
  ["kuwait-rest-fish-market.jpg", "Mercado del pescado, ciudad de Kuwait, Kuwait, 2024-08-12, DD 30.jpg"],
  ["kuwait-rest-kiwi-kabab.jpg", "Kiwi 1.jpg"],
  ["kuwait-rest-pizza-hut-1982.jpg", "Kuwait 1982-0108.jpg"],
];

async function commonsUrl(title) {
  const u = new URL("https://commons.wikimedia.org/w/api.php");
  u.searchParams.set("action", "query");
  u.searchParams.set("format", "json");
  u.searchParams.set("titles", "File:" + title);
  u.searchParams.set("prop", "imageinfo");
  u.searchParams.set("iiprop", "url");
  u.searchParams.set("iiurlwidth", "960");
  const r = await fetch(u, {
    headers: { "User-Agent": "qadha-game-restaurant-assets/1.0 (educational)" },
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
        headers: { "User-Agent": "qadha-game-restaurant-assets/1.0 (educational-quiz)" },
      });
      if (bin.ok) break;
      if (bin.status === 429 && attempt < 5) {
        await new Promise((r) => setTimeout(r, 5000 + attempt * 4000));
        continue;
      }
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
