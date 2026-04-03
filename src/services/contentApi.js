import { apiBase } from "./apiBase.js";

const LS_VER = "qadha_remote_content_ver";
const LS_OVERLAY = "qadha_remote_overlay_cache";

export function readCachedOverlayMeta() {
  try {
    const ver = Number(localStorage.getItem(LS_VER) || "0");
    const raw = localStorage.getItem(LS_OVERLAY);
    const overlay = raw ? JSON.parse(raw) : {};
    return { contentVersion: ver, overlay };
  } catch {
    return { contentVersion: 0, overlay: {} };
  }
}

export function writeCachedOverlay(contentVersion, overlay) {
  try {
    localStorage.setItem(LS_VER, String(contentVersion));
    localStorage.setItem(LS_OVERLAY, JSON.stringify(overlay || {}));
  } catch {
    /* ignore */
  }
}

export async function fetchContentManifest() {
  const base = apiBase();
  const r = await fetch(`${base}/api/content/manifest`);
  if (!r.ok) throw new Error(`manifest ${r.status}`);
  return r.json();
}

export async function fetchContentOverlay() {
  const base = apiBase();
  const r = await fetch(`${base}/api/content/overlay`);
  if (!r.ok) throw new Error(`overlay ${r.status}`);
  return r.json();
}

/**
 * يحدّث الـ overlay المحلي إن زاد رقم الإصدار على السيرفر.
 * لا يرمي إذا تعذّر الاتصال (اللعبة تعمل بدون خادم).
 */
export async function syncContentOverlayFromServer() {
  let manifest;
  try {
    manifest = await fetchContentManifest();
  } catch {
    return readCachedOverlayMeta();
  }
  const remoteV = manifest.contentVersion ?? 0;
  const local = readCachedOverlayMeta();
  if (remoteV <= local.contentVersion && Object.keys(local.overlay).length) {
    return local;
  }
  try {
    const { contentVersion, overlay } = await fetchContentOverlay();
    const v = contentVersion ?? remoteV;
    writeCachedOverlay(v, overlay || {});
    return { contentVersion: v, overlay: overlay || {} };
  } catch {
    return local;
  }
}
