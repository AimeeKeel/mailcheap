import { CAMPAIGN_STEPS } from "@/lib/campaign-steps";
import { cn } from "@/lib/utils";

// Compact tabs on phones and tablets, a numbered stepper from lg. Any step is one click away, in either direction.
export default function NavSteps({ step, onStep, className }) {
	return (
		<nav aria-label="Steps" className={className}>
			<ol className="grid grid-cols-3 gap-1 rounded-lg bg-muted/70 p-1 lg:flex lg:items-center lg:gap-2 lg:bg-transparent lg:p-0">
				{CAMPAIGN_STEPS.map(({ id, label }, index) => {
					const isCurrent = id === step;
					return (
						<li key={id} className="flex items-center lg:gap-2">
							{index > 0 && <span aria-hidden="true" className="hidden h-px w-8 bg-border/50 lg:block" />}
							<button
								type="button"
								aria-current={isCurrent ? "step" : undefined}
								onClick={() => onStep(id)}
								className={cn(
									"flex h-8 w-full items-center justify-center gap-1.5 rounded-md text-sm outline-none transition-[color,background-color,box-shadow,scale] duration-150 ease-out focus-visible:ring-3 focus-visible:ring-ring/50 active:scale-[0.97] lg:h-7 lg:w-auto lg:rounded-full lg:px-1.5",
									isCurrent
										? "bg-background font-medium text-foreground shadow-sm lg:bg-transparent lg:shadow-none"
										: "font-normal text-muted-foreground/80 hover:text-foreground"
								)}
							>
								<span
									className={cn(
										"grid size-5 shrink-0 place-items-center rounded-full text-[11px] tabular-nums transition-colors duration-150",
										isCurrent ? "bg-foreground/80 text-background" : "text-muted-foreground/70"
									)}
								>
									{index + 1}
								</span>
								{label}
							</button>
						</li>
					);
				})}
			</ol>
		</nav>
	);
}
