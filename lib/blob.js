import "server-only";
import { put } from "@vercel/blob";

// Sent emails point at these files forever, so their URLs never change and browsers can cache them for a year.
const ONE_YEAR = 365 * 24 * 60 * 60;

export async function putImage(pathname, bytes, contentType) {
	const blob = await put(pathname, bytes, {
		access: "public",
		contentType,
		addRandomSuffix: true,
		cacheControlMaxAge: ONE_YEAR,
	});
	return blob.url;
}
