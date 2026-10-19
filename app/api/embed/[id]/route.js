import crypto from "node:crypto";
import { after } from "next/server";
import { sendAlert } from "@/lib/alerts";
import { getAppSecret, getAppUrl } from "@/lib/config";
import { cleanFirstName } from "@/lib/contact-fields";
import { getSignupProblem } from "@/lib/contacts";
import { connectDb } from "@/lib/db";
import { findSignupNewsletter } from "@/lib/public-newsletters";
import { getClientIp, isRateLimited } from "@/lib/rate-limit";
import {
	EMBED_SOURCE,
	SIGNUP_FORM_RATE_LIMITS,
	getHost,
	getSignupFormPaths,
	isAllowedHost,
	toSignupFormSettings,
} from "@/lib/signup-form";
import { MAX_FORM_AGE_MS, MIN_FILL_MS, createDoneToken, readFormToken } from "@/lib/signup-form-token";
import { addSignup } from "@/lib/signups";
import { isObjectIdString, isPlainObject, normalizeEmail } from "@/lib/validation";

// Signups from the forms owners paste on their own sites (lib/signup-form.js). The framed form posts JSON from its own
// page; the plain HTML form posts from anywhere and lands on /embed/<id>/done. BotID can't run on other sites, so the
// checks are a hidden field, the framed form's signed load time and site, the browser's Origin, the owner's list of
// sites, and limits per visitor and per address: an address gets a few signups a day, whichever newsletters ask, so a
// script can't flood a stranger with confirmation emails.
const { perIp: PER_IP, perEmail: PER_EMAIL, perNewsletter: PER_NEWSLETTER } = SIGNUP_FORM_RATE_LIMITS;
const FORM_OFF = "This form isn't taking signups";
const CORS_HEADERS = {
	"access-control-allow-origin": "*",
	"access-control-allow-methods": "POST, OPTIONS",
	"access-control-allow-headers": "content-type, accept",
	"access-control-max-age": "86400",
};

export function OPTIONS() {
	return new Response(null, { status: 204, headers: CORS_HEADERS });
}

export async function POST(request, { params }) {
	const { id } = await params;
	const reply = createReply(request, id);
	const fields = await readFields(request);
	if (!fields) return reply.error(400, "Enter a valid email");
	// People never see this field; bots fill in every input they find.
	if (fields.website) return reply.done({ result: "subscribed" });
	if (!isObjectIdString(id)) return reply.error(404, FORM_OFF);
	if (await isRateLimited({ ...PER_IP, key: getClientIp(request.headers) })) {
		return reply.error(429, "Too many signups from your network. Try again in a few minutes.");
	}

	await connectDb();
	const newsletter = await findSignupNewsletter({ _id: id });
	const settings = toSignupFormSettings(newsletter?.signupForm);
	if (!newsletter || !settings.enabled) return reply.error(404, FORM_OFF);

	// The framed form names the page it was on in its token, from when it loaded; for the plain form, the browser names it.
	// Every browser sends an Origin with a form posted from another site: without one, a script is posting.
	let host;
	if (fields.token) {
		const token = readFormToken(fields.token, { newsletterId: id });
		if (!token || token.age > MAX_FORM_AGE_MS) return reply.error(400, "This form expired. Reload the page and try again.");
		if (token.age < MIN_FILL_MS) return reply.error(400, "One second, then try again.");
		host = getHost(token.origin);
	} else {
		const origin = request.headers.get("origin");
		if (origin === null) return reply.error(400, "Couldn't sign you up. Try again from the form.");
		host = getHost(origin) ?? getHost(request.headers.get("referer"));
	}
	if (!isAllowedHost(host, settings.allowedDomains)) return reply.error(403, "This form doesn't take signups on this site");

	const email = normalizeEmail(fields.email);
	if (!email) return reply.error(400, "Enter a valid email");
	if (await isRateLimited({ ...PER_EMAIL, key: hashEmail(email) })) {
		return reply.error(429, "This address signed up too many times today. Try again tomorrow.");
	}
	const problem = await getSignupProblem(email);
	if (problem) return reply.error(400, problem);

	if (await isRateLimited({ ...PER_NEWSLETTER, key: id })) {
		after(() =>
			sendAlert({
				accountId: newsletter.accountId,
				key: `embed-flood:${newsletter.slug}`,
				title: "Signup form flood",
				detail: `Over ${PER_NEWSLETTER.limit} signups to ${newsletter.name} from forms on other sites in 10 minutes. They still go through (${PER_IP.limit} per visitor per 10 minutes); check new contacts for junk, or list your sites in the form's settings.`,
				path: "/newsletters/form",
			})
		);
	}

	const { isPending, inbox } = await addSignup({
		newsletter,
		email,
		source: EMBED_SOURCE,
		sourceDomain: host,
		firstName: settings.askFirstName ? cleanFirstName(fields.firstName) : "",
		confirmReturning: true,
	});
	return reply.done({ result: isPending ? "pending" : "subscribed", inbox });
}

// JSON for the framed form and for scripts that ask for it; a redirect to the result page for the plain HTML form.
function createReply(request, id) {
	const wantsJson = [request.headers.get("accept"), request.headers.get("content-type")].some((value) =>
		String(value ?? "").includes("application/json")
	);
	const back = request.headers.get("referer") || request.headers.get("origin") || null;

	function redirect(done) {
		const url = new URL(getSignupFormPaths(id).done, getAppUrl());
		url.searchParams.set("s", createDoneToken({ ...done, back }));
		return new Response(null, { status: 303, headers: { ...CORS_HEADERS, location: url.toString() } });
	}

	return {
		done({ result, inbox = null }) {
			if (!wantsJson) return redirect({ result, inbox });
			return Response.json({ ok: true, pending: result === "pending", inbox }, { headers: CORS_HEADERS });
		},
		error(status, message) {
			if (!wantsJson) return redirect({ result: "error", message });
			return Response.json({ error: message }, { status, headers: CORS_HEADERS });
		},
	};
}

async function readFields(request) {
	try {
		const isJson = String(request.headers.get("content-type") ?? "").includes("application/json");
		const body = isJson ? await request.json() : Object.fromEntries(await request.formData());
		if (!isPlainObject(body)) return null;
		const read = (key) => (typeof body[key] === "string" ? body[key] : "");
		return { email: read("email"), firstName: read("first_name") || read("firstName"), website: read("website"), token: read("token") };
	} catch {
		return null;
	}
}

// The limiter keys addresses by a keyed hash, so the rate limit store never holds them.
function hashEmail(email) {
	return crypto.createHmac("sha256", getAppSecret()).update(`embed-email:${email}`).digest("base64url").slice(0, 32);
}
