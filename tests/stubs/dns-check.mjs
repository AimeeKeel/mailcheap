// CNAMEs set by tests instead of looked up.
export const cnames = new Map();

export async function readCnames(host) {
	return cnames.get(host) ?? [];
}
