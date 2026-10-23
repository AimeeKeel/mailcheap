import { BACKOFF, FIRST_SEND, SENDER_WARMUP } from "./config.js";
import { formatCount, formatNumber } from "./format.js";
import { getGrowth, getPaceRoom, getSenderDayEmails, getSenderDaysLeft } from "./send-spread.js";

const HOUR_MS = 60 * 60 * 1000;

// Why each warm-up notice (components/NoticeWarmup.jsx) is there. Its link says more.
export const WARMUP_WHY = "Going step by step protects your reputation, so your emails land in the inbox.";
export const BACKOFF_WHY = `Waiting protects your reputation with Gmail. Resuming earlier still waits for those ${BACKOFF.hours} hours.`;
export const FIRST_SEND_WHY = "A problem with a list shows in the slice, before it reaches everyone.";

// The account's warm-up as a track of a warm-up notice: its day, what goes out now, and what comes next.
export function getAccountTrack(pace) {
	const { warmup } = pace;
	const room = formatNumber(getPaceRoom(pace));
	const growth = Math.round(getGrowth(warmup.hasStarted ? warmup.day : 1));
	return {
		label: "Your account",
		day: warmup.hasStarted ? warmup.day : 0,
		days: warmup.days,
		progress: warmup.progress,
		now: warmup.hasStarted ? `Up to ${room} emails go out at once.` : `Starts with your first campaign: up to ${room} emails at once.`,
		next: `a send with few bounces and complaints lets the next be ${growth === 2 ? "twice" : `${growth} times`} as big, a day later.`,
	};
}

// A sending domain in its first week (lib/send-spread.js getSenderPace) as a track, a step per day.
export function getAddressTrack(sender) {
	const today = getSenderDayEmails(sender);
	const track = {
		label: sender.domain ?? "This newsletter's address",
		domain: sender.domain,
		day: sender.hasStarted && !sender.waitMs ? sender.day : 0,
		days: SENDER_WARMUP.days,
		isStepped: true,
	};
	if (sender.waitMs > 0) {
		const hours = formatCount(Math.ceil(sender.waitMs / HOUR_MS), "hour");
		return { ...track, now: `Starts again in ${hours}: ${formatNumber(today)} emails that day.`, next: "twice as many each day after." };
	}
	if (!sender.hasStarted) {
		return { ...track, now: `Starts with its next campaign: ${formatNumber(today)} emails the first day.`, next: "twice as many each day after." };
	}
	const next =
		sender.day >= SENDER_WARMUP.days
			? "full speed from tomorrow."
			: `${formatNumber(today * 2)} tomorrow, full speed in ${formatCount(getSenderDaysLeft(sender), "day")}.`;
	return { ...track, now: `${formatNumber(today)} emails today.`, next };
}

// The warm-up that paces a send going out: its address's in its first week, else the account's.
export function getPaceTrack(pace) {
	if (pace?.sender) return getAddressTrack(pace.sender);
	return pace?.warmup ? getAccountTrack(pace) : null;
}

// A first send's steps (lib/first-send.js): the slice of contacts never emailed, then the rest after its check. after:
// when the rest goes, as the page says it.
export function getFirstSendSteps({ slice, held, after = `${FIRST_SEND.waitMinutes / 60} hours later` }) {
	return [
		{ text: `${formatNumber(slice)} contacts who never got an email from you go first.`, isCurrent: true },
		{ text: `The other ${formatNumber(held)} follow ${after}, if few bounce or complain.` },
	];
}
