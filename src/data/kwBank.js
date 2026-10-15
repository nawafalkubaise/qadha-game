/**
 * أسئلة الكويت: ملفات JSON لكل فئة تحت src/data/banks/kw/
 * + دمج kwImportedBank.json. كل شيء يُجلب عند الطلب.
 */
import { loadKwBankFlat } from "./banksLoader.js";
import { mergeKwBank } from "./kwMergeImported.js";

export async function loadKwMergedBank() {
  const [flat, imported] = await Promise.all([
    loadKwBankFlat(),
    import("./kwImportedBank.json").then((m) => m.default),
  ]);
  return mergeKwBank(flat, imported);
}
