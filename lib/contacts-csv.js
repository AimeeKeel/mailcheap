// Column names the CSV import recognizes, so an export goes back in as it is.
export const CSV_COLUMNS = [
	["email", (contact) => contact.email],
	["status", (contact) => contact.status],
	["newsletter", (contact, newsletters) => newsletters.get(String(contact.newsletterId)) ?? ""],
	["source", (contact) => contact.source ?? ""],
	["subscribed_at", (contact) => contact.subscribedAt],
	["confirmed_at", (contact) => contact.confirmedAt],
	["unsubscribed_at", (contact) => contact.unsubscribedAt],
	["last_sent_at", (contact) => contact.lastSentAt],
	["last_open_at", (contact) => contact.lastOpenAt],
	["last_click_at", (contact) => contact.lastClickAt],
	["emails_received", (contact) => contact.stats?.sent ?? 0],
	["opens", (contact) => contact.stats?.opens ?? 0],
	["clicks", (contact) => contact.stats?.clicks ?? 0],
];

// Spreadsheets run a cell starting with = + - @ as a formula; a leading quote keeps it text. Email
// addresses are left as they are: without parentheses they can't call anything, and a quote would
// change the address on the way back in.
function toCell(value, isEmail) {
	if (value === undefined || value === null) return "";
	const text = value instanceof Date ? value.toISOString() : String(value);
	const safe = !isEmail && /^[=+\-@\t\r]/.test(text) ? `'${text}` : text;
	return /[",\n\r]/.test(safe) ? `"${safe.replaceAll('"', '""')}"` : safe;
}

export function getCsvHeader() {
	return `${CSV_COLUMNS.map(([name]) => name).join(",")}\r\n`;
}

// newsletters: newsletter ID to slug.
export function toCsvRow(contact, newsletters = new Map()) {
	return `${CSV_COLUMNS.map(([name, read]) => toCell(read(contact, newsletters), name === "email")).join(",")}\r\n`;
}
