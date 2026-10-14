import { FIRST_SEND } from "@/lib/first-send";
import { formatNumber } from "@/lib/format";

// In the send and schedule dialogs when more contacts than a first slice never got an email (lib/first-send.js).
export default function NoticeFirstSend({ count }) {
	return (
		<p className="rounded-lg bg-muted/60 px-3 py-2.5 text-sm text-pretty tabular-nums">
			{formatNumber(count)} contacts never got an email from you. A slice of them goes first, and the rest {FIRST_SEND.waitMinutes / 60}{" "}
			hours after it if its bounces and complaints stay under the limits. Over them, your account is blocked.
		</p>
	);
}
