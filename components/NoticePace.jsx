import Link from "next/link";
import NoticeWarmup from "@/components/NoticeWarmup";
import { getFirstSendSteps } from "@/lib/first-send";
import { GMAIL_WHY, STEPS_WHY, getGmailTrack, getStepItems } from "@/lib/warmup-status";

// In the send step and the send-more dialog, only when a send won't go out at once: the steps its contacts who never got
// an email go in (lib/first-send.js), and the Gmail readers a new domain sends the next day (lib/send-spread.js), with a
// way to skip that from a domain of their own. gmailShare: the audience's share of Gmail addresses. Self-hosted servers
// have no pace (null): only the steps.
export default function NoticePace({ pace, emails, newContacts = 0, gmailShare = 0, isSharedSender = false }) {
	const sender = pace?.sender ?? null;
	const steps = getFirstSendSteps(Math.min(newContacts, emails));
	const gmail = getGmailTrack(sender, Math.round(emails * gmailShare));
	if (!steps && !gmail) return null;
	const gmailTitle = sender?.isGradual ? "Gmail gets it more slowly for now" : "Some Gmail readers get it tomorrow";

	return (
		<NoticeWarmup
			title={steps ? `Goes out in ${steps.length} steps` : gmailTitle}
			steps={steps ? getStepItems(steps) : []}
			tracks={gmail ? [gmail] : []}
			why={steps ? STEPS_WHY : GMAIL_WHY}
			help={steps ? { article: "sending", section: "first-send" } : { article: "warm-up", section: sender?.isGradual ? "gmail" : "new-domain" }}
		>
			{gmail && (steps || isSharedSender) && (
				<p className="text-xs text-pretty text-muted-foreground">
					{steps && `${GMAIL_WHY} `}
					{isSharedSender && (
						<>
							From a domain you already send newsletters with, it all goes today.{" "}
							<Link href="/domains" className="font-medium text-foreground underline underline-offset-4">
								Add a domain
							</Link>
						</>
					)}
				</p>
			)}
		</NoticeWarmup>
	);
}
