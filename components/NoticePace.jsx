import LinkHelp from "@/components/LinkHelp";
import NoticeWarmup from "@/components/NoticeWarmup";
import { FIRST_SEND } from "@/lib/config";
import { getFirstSendSlice } from "@/lib/first-send";
import { formatNumber } from "@/lib/format";
import { formatPaceTime, getPaceHours, getPaceRoom, isSenderPaced } from "@/lib/send-spread";
import { FIRST_SEND_WHY, WARMUP_WHY, getAccountTrack, getAddressTrack, getFirstSendSteps } from "@/lib/warmup-status";

// In the send step and the send-more dialog, how a send goes out, in the warm-up notice's look: the hours it goes out
// over when the account's warm-up or its newsletter's new address paces it (lib/send-spread.js), where that warm-up
// stands, and the slice that goes first when it reaches contacts never emailed (lib/first-send.js). Nothing for a send at
// full speed past the warm-ups; on a self-hosted server, which has none, only the slice.
export default function NoticePace({ pace, emails, newContacts = 0 }) {
	const hours = getPaceHours(pace, { emails, newContacts });
	const warmup = pace?.warmup;
	const isSender = hours > 0 && isSenderPaced(pace, emails);
	const neverMailed = Math.min(newContacts, emails);
	const slice = getFirstSendSlice(neverMailed);
	if (!pace) {
		if (slice === null) return null;
		return (
			<p className="rounded-xl bg-muted/60 p-3.5 text-sm text-pretty tabular-nums">
				{formatNumber(neverMailed)} contacts never got an email from you, so a slice of them goes first and the rest{" "}
				{FIRST_SEND.waitMinutes / 60} hours later, if the slice looks clean. <LinkHelp article="sending" section="first-send" />
			</p>
		);
	}
	if (!hours && !warmup && slice === null) return null;
	const isWarming = hours > 0 || Boolean(warmup);
	const track = isSender ? getAddressTrack(pace.sender) : warmup && getAccountTrack(pace);

	return (
		<NoticeWarmup
			title={getTitle({ hours, isSender, warmup })}
			tracks={track ? [track] : []}
			steps={slice === null ? [] : getFirstSendSteps({ slice, held: neverMailed - slice })}
			why={isWarming ? WARMUP_WHY : FIRST_SEND_WHY}
			help={
				isSender
					? { article: "warm-up", section: "new-address" }
					: isWarming
						? { article: "warm-up" }
						: { article: "sending", section: "first-send" }
			}
		>
			{hours > 0 && !track && <p className="text-pretty tabular-nums">For now, up to {formatNumber(getPaceRoom(pace))} emails go out at once.</p>}
		</NoticeWarmup>
	);
}

function getTitle({ hours, isSender, warmup }) {
	if (hours) {
		const what = isSender ? "this newsletter's address warms up" : `your account warms up${warmup ? "" : " to sends this size"}`;
		return `Goes out over ${formatPaceTime(hours)} while ${what}`;
	}
	if (warmup) return warmup.hasStarted ? "Your account is warming up" : "This first campaign starts your account's warm-up";
	return "Goes out in steps";
}
