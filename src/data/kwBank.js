/**
 * أسئلة الكويت: ملفات JSON لكل فئة تحت src/data/banks/kw/
 * + دمج kwImportedBank.json.
 */
import imported from "./kwImportedBank.json" with { type: "json" };
import { loadKwBankFlat } from "./banksLoader.js";
import { mergeKwBank } from "./kwMergeImported.js";

export const KW = loadKwBankFlat();
export const KW_MERGED = mergeKwBank(KW, imported);
