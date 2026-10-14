import * as z from "zod";

export const KEY_LEVELS = ["full", "signups"];
const METHODS = ["GET", "POST", "PATCH", "DELETE"];
const NAME_PATTERN = /^[a-z]+(?:_[a-z]+)*$/;
const PATH_PATTERN = /^(?:\/(?:[a-z][a-z-]*|\{[a-zA-Z]+\}))+$/;

function assert(condition, name, message) {
	if (!condition) throw new Error(`Action ${name}: ${message}`);
}

// One customer action, written once: the dashboard, the REST API and the MCP server all run it through
// runAction. permission "signups" opens it to signups only keys too; everything else needs full access.
// The four hints are MCP's tool annotations: readOnly never changes anything, destructive can't be undone,
// idempotent means a repeat call adds no effect, openWorld reaches outside MailCheap (email, Stripe, DNS).
// example: an input the docs show in the request example. tryWithoutPlan: the dashboard runs it for an account
// without a plan, which can set up its newsletter and write before paying; the REST API and MCP still need one.
// whileBlocked: a blocked account (lib/account-blocks.js) can still run it. Reads can; of the changes, only those
// that stop something or leave: pausing, unscheduling, revoking access, billing.
export function defineAction({
	name,
	title,
	description,
	group,
	http,
	input = z.object({}),
	output,
	example = {},
	permission = "full",
	readOnly = false,
	destructive = false,
	idempotent = readOnly,
	openWorld = false,
	requiresPlan = true,
	tryWithoutPlan = false,
	whileBlocked = readOnly,
	rateLimit = null,
	handler,
}) {
	assert(NAME_PATTERN.test(name ?? ""), name, "name must be snake_case");
	assert(title && description && group, name, "title, description and group are required");
	assert(METHODS.includes(http?.method) && PATH_PATTERN.test(http?.path ?? ""), name, "http needs a method and a path");
	assert(input instanceof z.ZodObject && output instanceof z.ZodObject, name, "input and output must be z.object schemas");
	assert(KEY_LEVELS.includes(permission), name, `permission must be one of ${KEY_LEVELS.join(", ")}`);
	assert(!(readOnly && destructive), name, "a read-only action can't be destructive");
	assert(typeof handler === "function", name, "handler is required");
	assert(input.partial().safeParse(example).success, name, "example must match the input");
	return Object.freeze({
		name,
		title,
		description,
		group,
		http: Object.freeze({ status: 200, ...http }),
		input,
		output,
		example,
		permission,
		readOnly,
		destructive,
		idempotent,
		openWorld,
		requiresPlan,
		tryWithoutPlan,
		whileBlocked,
		rateLimit,
		handler,
	});
}

// Path parameters, e.g. ["id"] for /campaigns/{id}.
export function getPathParams(path) {
	return [...path.matchAll(/\{([a-zA-Z]+)\}/g)].map(([, param]) => param);
}

export function canKeyUse(level, action) {
	return level === "full" || action.permission === "signups";
}
