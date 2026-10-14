import "server-only";
import { resolveCname } from "node:dns/promises";

// Where a hostname's CNAME points, lowercased without the trailing dot. Nothing (or an error) is [].
export async function readCnames(host) {
	try {
		return (await resolveCname(host)).map((target) => target.toLowerCase().replace(/\.$/, ""));
	} catch {
		return [];
	}
}
