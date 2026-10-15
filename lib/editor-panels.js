import { readStoredNumber, storeValue } from "./storage.js";

// What the campaign editor remembers in the browser: which panels are open, and the preview's device. The preview
// docks beside the writing column on wide screens only, from FormCampaign's min-[90rem] classes; on smaller ones it
// opens over the editor and never by itself.
export const EDITOR_PANELS = {
	checklist: { key: "mailcheap:editor-checklist" },
	preview: { key: "mailcheap:editor-preview", media: "(min-width: 90rem)" },
};

const DEVICE_KEY = "mailcheap:editor-preview-device";

// False on the server, which can't know: restorePanels makes the server's HTML agree before React hydrates.
export function readPanel({ key, media }) {
	if (typeof window === "undefined") return false;
	return readStoredNumber(key) === 1 && (!media || window.matchMedia(media).matches);
}

export function storePanel({ key }, isOpen) {
	storeValue(key, isOpen ? 1 : 0);
}

// Runs as an inline script while the page's HTML is parsed, before its first paint, so a reload shows the panels as
// they were left without moving the editor. It's sent as source text: it can't use anything from outside itself.
export function restorePanels(panels) {
	try {
		const root = document.currentScript.parentElement;
		for (const [name, { key, media }] of Object.entries(panels)) {
			if (localStorage.getItem(key) !== "1" || (media && !matchMedia(media).matches)) continue;
			root.setAttribute(`data-${name}`, "");
			root.querySelector(`[data-toggle="${name}"]`)?.setAttribute("aria-pressed", "true");
		}
	} catch {}
}

export function readPreviewDevice() {
	return readStoredNumber(DEVICE_KEY) === 1 ? "mobile" : "desktop";
}

export function storePreviewDevice(device) {
	storeValue(DEVICE_KEY, device === "mobile" ? 1 : 0);
}
