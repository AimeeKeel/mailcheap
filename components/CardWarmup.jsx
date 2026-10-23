import NoticeWarmup from "@/components/NoticeWarmup";
import { WARMUP_WHY, getAccountTrack, getAddressTrack } from "@/lib/warmup-status";

// On the overview while the account or the open newsletter's address warms up (lib/send-spread.js): where each stands and
// what comes next.
export default function CardWarmup({ pace }) {
	const tracks = [pace.warmup && getAccountTrack(pace), pace.sender && getAddressTrack(pace.sender)].filter(Boolean);
	return <NoticeWarmup variant="card" title="Your sending is warming up" tracks={tracks} why={WARMUP_WHY} help={{ article: "warm-up" }} />;
}
