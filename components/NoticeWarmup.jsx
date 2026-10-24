import IconWarmup from "@/components/IconWarmup";
import ImageFavicon from "@/components/ImageFavicon";
import LinkHelp from "@/components/LinkHelp";
import ProgressWarmup from "@/components/ProgressWarmup";
import { cn } from "@/lib/utils";

// Every place the dashboard says a send goes slower than at once, in one look: what's happening, the steps of a first send
// (lib/warmup-status.js getStepItems: done, current, next) with a bar of them once it's going out (progress), how
// Gmail's readers are held back on a new domain (tracks), and why, with a link to read more.
export default function NoticeWarmup({ title, meta, progress, steps = [], tracks = [], why, help, className, children }) {
	return (
		<div className={cn("flex flex-col gap-3 rounded-xl bg-muted/60 p-3.5 text-sm", className)}>
			<div className="flex items-start justify-between gap-3">
				<p className="flex gap-2 font-medium text-balance">
					<IconWarmup className="mt-0.5 text-orange-500" />
					{title}
				</p>
				{meta && <span className="shrink-0 text-muted-foreground tabular-nums">{meta}</span>}
			</div>
			{progress && <ProgressWarmup value={progress.value} max={progress.max} isStepped label={progress.label} />}
			{steps.length > 0 && (
				<ol className="flex flex-col gap-1.5">
					{steps.map((step, index) => (
						<li key={step.text} className="flex gap-2 text-pretty tabular-nums">
							<span
								className={cn(
									"grid size-5 shrink-0 place-items-center rounded-full text-xs font-medium",
									step.state === "done" && "bg-orange-500 text-white",
									step.state === "current" && "bg-background text-orange-600 ring-1 ring-orange-500 ring-inset dark:text-orange-400",
									step.state === "next" && "bg-foreground/10 text-muted-foreground"
								)}
							>
								{index + 1}
							</span>
							<span className={step.state === "current" ? undefined : "text-muted-foreground"}>{step.text}</span>
						</li>
					))}
				</ol>
			)}
			{tracks.map((track) => (
				<TrackWarmup key={track.label} track={track} />
			))}
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
				label={`${track.label}: Gmail's days`}
			/>
			<p className="text-pretty tabular-nums">
				{track.now}
				{track.next && <span className="text-muted-foreground"> Next: {track.next}</span>}
			</p>
		</div>
	);
}
