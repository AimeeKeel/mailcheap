import "server-only";
import { NextResponse } from "next/server";
import { verifySignatureAppRouter } from "@upstash/qstash/nextjs";

// Jobs only run when QStash signed the request. There's no QStash locally, so dev runs them unsigned.
export function withQStashSignature(handler) {
	let verifiedHandler;
	return async function POST(request) {
		if (process.env.NODE_ENV === "development") return handler(request);
		if (!process.env.QSTASH_CURRENT_SIGNING_KEY || !process.env.QSTASH_NEXT_SIGNING_KEY) {
			return NextResponse.json({ error: "QStash is not configured" }, { status: 503 });
		}
		// Created on first use: verifySignatureAppRouter throws right away when signing keys are missing.
		verifiedHandler ??= verifySignatureAppRouter(handler);
		return verifiedHandler(request);
	};
}
