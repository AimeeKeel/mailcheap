import "server-only";
import { slugify } from "@/lib/slug";
import Campaign from "@/models/Campaign";

export async function uniqueArchiveSlug(base) {
	for (let suffix = 1; suffix < 100; suffix += 1) {
		const slug = suffix === 1 ? base : `${base}-${suffix}`;
		if (!(await Campaign.exists({ archiveSlug: slug }))) return slug;
	}
	return `${base}-${Date.now()}`;
}

// Unless the API set one, the slug comes from the subject as it is when the issue goes out, so the
// /p/ page exists before the first email links to it.
export async function assignArchiveSlug({ campaign, newsletter }) {
	if (!newsletter.archiveEnabled || campaign.archiveSlug) return;
	await Campaign.updateOne(
		{ _id: campaign._id },
		{ $set: { archiveSlug: await uniqueArchiveSlug(slugify(campaign.subject, 80) || "issue") } }
	);
}
