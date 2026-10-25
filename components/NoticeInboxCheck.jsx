"use client";

import { useId, useState, useTransition } from "react";
import { Check, Loader2, Mail } from "lucide-react";
import { sendInboxCheck } from "@/app/(app)/newsletters/actions";
import { dismissInboxCheck } from "@/app/welcome/actions";
import ButtonClose from "@/components/ButtonClose";
import { Button } from "@/components/ui/button";
import { toast } from "@/lib/toast";
import { cn } from "@/lib/utils";

// Above a newsletter's settings until it's closed (lib/inbox-check.js): an email from MailCheap to reply to, so its next
// ones reach the inbox. Gray like the pace notice (NoticeWarmup), with its steps: a helper that goes away, not a setting.
export default function NoticeInboxCheck({ newsletterId, stagger, className }) {
	const titleId = useId();
	const [isClosed, setIsClosed] = useState(false);
	const [sentTo, setSentTo] = useState(null);
	const [isSending, startSending] = useTransition();
	if (isClosed) return null;

	function send() {
		startSending(async () => {
			const result = await sendInboxCheck();
			if (result?.error) {
				toast.error(result.error);
				return;
			}
			setSentTo(result.sentTo);
		});
	}

	async function close() {
		setIsClosed(true);
		const result = await dismissInboxCheck(newsletterId);
		if (result?.error) toast.error(result.error);
	}

	return (
		<section
			aria-labelledby={titleId}
			style={{ "--stagger": stagger }}
			className={cn("flex flex-col gap-3 rounded-xl bg-muted/60 p-3.5 text-sm animate-enter", className)}
		>
			<div className="flex items-start justify-between gap-3">
				<h2 id={titleId} className="font-medium text-balance">
					Get MailCheap&apos;s emails in your inbox
				</h2>
				<ButtonClose onClick={close} className="-my-0.5 -mr-1" />
			</div>
			<ol className="flex flex-col gap-1.5">
				<Step number={1} state={sentTo ? "done" : "current"}>
					{sentTo ? (
						<>
							Sent to <span className="font-medium wrap-anywhere">{sentTo}</span>
						</>
					) : (
						"Send yourself an email from MailCheap"
					)}
				</Step>
				<Step number={2} state={sentTo ? "current" : "next"}>
					Reply to it with anything, like &ldquo;got it&rdquo;
					{sentTo && <span className="block text-muted-foreground">Not in your inbox? Look in spam and mark it as not spam.</span>}
				</Step>
			</ol>
			<div className="flex flex-wrap items-center gap-2">
				{sentTo ? (
					<>
						<Button size="sm" onClick={close}>
							Done
						</Button>
						<Button variant="ghost" size="sm" onClick={send} disabled={isSending}>
							{isSending && <Loader2 data-icon="inline-start" className="animate-spin" />}
							Send again
						</Button>
					</>
				) : (
					<Button variant="outline" size="sm" onClick={send} disabled={isSending}>
						{isSending ? <Loader2 data-icon="inline-start" className="animate-spin" /> : <Mail data-icon="inline-start" />}
						Send me an email
					</Button>
				)}
			</div>
			<p className="text-xs text-pretty text-muted-foreground">
				MailCheap only emails you when it matters, like a campaign that needs you or your summary, never for marketing. A
				reply keeps the next ones out of spam.
			</p>
		</section>
	);
}

function Step({ number, state, children }) {
	return (
		<li className="flex gap-2 text-pretty">
			<span
				aria-hidden="true"
				className={cn(
					"grid size-5 shrink-0 place-items-center rounded-full text-xs font-medium transition-colors duration-200",
					state === "done" && "bg-foreground text-background",
					state === "current" && "bg-background text-foreground ring-1 ring-foreground ring-inset",
					state === "next" && "bg-foreground/10 text-muted-foreground"
				)}
			>
				{state === "done" ? <Check className="size-3" strokeWidth={3} /> : number}
			</span>
			<span className={state === "next" ? "text-muted-foreground" : undefined}>{children}</span>
		</li>
	);
}
