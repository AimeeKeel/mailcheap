import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { announceTelegram } from "@/lib/alerts";
import { checkPostshibaStatus } from "@/lib/postshiba-status";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Vercel Cron sends CRON_SECRET as a bearer token; any other scheduler can too.
function isAuthorized(request, secret) {
	const expected = Buffer.from(`Bearer ${secret}`);
	const given = Buffer.from(request.headers.get("authorization") ?? "");
	return given.length === expected.length && timingSafeEqual(given, expected);
}

// Every hour: PostShiba's word on whether MailCheap can send, and Telegram's first message once it's set up.
export async function GET(request) {
	const secret = process.env.CRON_SECRET;
	if (!secret) return NextResponse.json({ error: "CRON_SECRET is not set" }, { status: 503 });
	if (!isAuthorized(request, secret)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
	const [postshiba, telegram] = await Promise.all([checkPostshibaStatus(), announceTelegram()]);
	console.info(`[hourly] ${JSON.stringify({ postshiba, telegram })}`);
	return NextResponse.json({ postshiba, telegram });
}
