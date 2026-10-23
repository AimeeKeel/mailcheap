import IconWarmup from "@/components/IconWarmup";
import ImageFavicon from "@/components/ImageFavicon";
import LinkHelp from "@/components/LinkHelp";
import ProgressWarmup from "@/components/ProgressWarmup";
import { cn } from "@/lib/utils";

// Every place the dashboard says sending warms up or slows down, in one look: what's happening, where each warm-up stands
// and what comes next (tracks, from lib/warmup-status.js), the steps of a send that goes in steps, and why, with a link
// to read more. variant "card": among the cards of a page, like the overview.
export default function NoticeWarmup({ title, meta, tracks = [], steps = [], why, help, variant = "inline", className, children }) {
	return (
		<div
			className={cn(
				"flex flex-col gap-3 text-sm",
				variant === "card" ? "rounded-2xl bg-card p-5 shadow-border sm:p-6" : "rounded-xl bg-muted/60 p-3.5",
				className
			)}
		>
			<div className="flex items-start justify-between gap-3">
				<p className="flex gap-2 font-medium text-balance">
					<IconWarmup className="mt-0.5 text-orange-500" />
					{title}
				</p>
				{meta && <span className="shrink-0 text-muted-foreground tabular-nums">{meta}</span>}
			</div>
			{tracks.map((track) => (
				<TrackWarmup key={track.label} track={track} />
			))}
			{steps.length > 0 && (
				<ol className="flex flex-col gap-1.5">
					{steps.map((step, index) => (
						<li key={step.text} className="flex gap-2 text-pretty tabular-nums">
							<span
								className={cn(
									"grid size-5 shrink-0 place-items-center rounded-full text-xs font-medium",
									step.isCurrent ? "bg-orange-500 text-white" : "bg-foreground/10 text-muted-foreground"
								)}
							>
								{index + 1}
							</span>
							<span className={step.isCurrent ? undefined : "text-muted-foreground"}>{step.text}</span>
						</li>
					))}
				</ol>
			)}
			{children}
			{why && (
				<p className="text-xs text-pretty text-muted-foreground">
					{why} {help && <LinkHelp article={help.article} section={help.section} />}
				</p>
			)}
		</div>
	);
}

function TrackWarmup({ track }) {
	return (
		<div className="flex flex-col gap-1.5">
			<div className="flex items-center justify-between gap-3 text-xs">
				<span className="flex min-w-0 items-center gap-1.5 text-muted-foreground">
					{track.domain && <ImageFavicon domain={track.domain} size={14} />}
					<span className="truncate">{track.label}</span>
				</span>
				<span className="shrink-0 font-medium tabular-nums">{track.day ? `Day ${track.day} of ${track.days}` : `${track.days} days`}</span>
			</div>
			<ProgressWarmup
				value={track.day}
				max={track.days}
				progress={track.progress}
				isStepped={track.isStepped}
				label={`${track.label}: warm-up`}
			/>
			<p className="text-pretty tabular-nums">
				{track.now} <span className="text-muted-foreground">Next: {track.next}</span>
			</p>
		</div>
	);
}
