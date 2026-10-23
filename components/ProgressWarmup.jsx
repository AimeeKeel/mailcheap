import { cn } from "@/lib/utils";

// A warm-up's progress (lib/warmup-status.js): a bar for the account's 30 days, a step per day for an address's first
// week. value: its day, 0 before it starts. progress: how far along, when it's finer than its day.
export default function ProgressWarmup({ value, max, progress = value / max, isStepped = false, label = "Warm-up", className }) {
	return (
		<div
			role="progressbar"
			aria-label={label}
			aria-valuemin={0}
			aria-valuemax={max}
			aria-valuenow={value}
			className={cn(isStepped ? "flex gap-1" : "h-1.5 overflow-hidden rounded-full bg-foreground/10", className)}
		>
			{isStepped ? (
				Array.from({ length: max }, (_, index) => (
					<span key={index} className={cn("h-1.5 flex-1 rounded-full", index < value ? "bg-orange-500" : "bg-foreground/10")} />
				))
			) : (
				<div className="h-full rounded-full bg-orange-500" style={{ width: `${Math.max(progress * 100, value ? 2 : 0)}%` }} />
			)}
		</div>
	);
}
