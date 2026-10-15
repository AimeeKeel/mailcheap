import "server-only";
import { scoped } from "@/lib/account-scope";
import { getSharedDomain } from "@/lib/config";
import { connectDb } from "@/lib/db";
import { formatNumber } from "@/lib/format";
import { PLANS, getPlan } from "@/lib/plans";
import { isReservedSlug } from "@/lib/reserved-slugs";
import { slugify } from "@/lib/slug";
import Newsletter from "@/models/Newsletter";

// One issue a week: 52 over 12 months.
const ISSUES_PER_MONTH = 4.33;

// The list a new account says it has, in the plans' subscriber steps: each size but the ends is the id of
// the plan whose subscribers it stops at.
export const LIST_SIZES = [
	{ id: "none", label: "Not yet" },
	...PLANS.map((plan, index) => ({
		id: plan.id,
		label: index === 0 ? `Under ${formatNumber(plan.subscribers)}` : `${formatNumber(PLANS[index - 1].subscribers)} to ${formatNumber(plan.subscribers)}`,
	})),
	{ id: "more", label: `Over ${formatNumber(PLANS.at(-1).subscribers)}` },
];

export const LIST_SOURCES = ["Substack", "beehiiv", "Mailchimp", "Kit", "Ghost", "Somewhere else"];

// The plan the paywall shows first: the smallest with the emails for one issue a week to the top of the account's list
// size, else the largest. Without a list, the smallest.
export function getRecommendedPlanId(account) {
	const size = account?.onboarding?.listSize;
	if (size === "more") return PLANS.at(-1).id;
	const emails = Math.ceil((getPlan(size)?.subscribers ?? 0) * ISSUES_PER_MONTH);
	return (PLANS.find((plan) => plan.emailsPerMonth >= emails) ?? PLANS.at(-1)).id;
}

// With a shared domain, a new account's first stop is /welcome, which names its newsletter. Without one, a
// newsletter needs a from address on the account's own domain, so the dashboard opens and Add a newsletter asks for it.
export async function needsOnboarding(account) {
	if (!getSharedDomain()) return false;
	await connectDb();
	return !(await Newsletter.exists(scoped(account)));
}

// The slug made from the name, numbered when another account's newsletter has it or MailCheap keeps it.
export async function findFreeSlug(name) {
	const base = slugify(name, 37) || "newsletter";
	for (let number = 1; number < 100; number++) {
		const slug = number === 1 ? base : `${base}-${number}`;
		if (!isReservedSlug(slug) && !(await Newsletter.exists({ slug }).setOptions({ crossAccount: true }))) return slug;
	}
	return `${slugify(name, 30) || "newsletter"}-${Date.now().toString(36)}`;
}
