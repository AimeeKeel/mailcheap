import { Skeleton } from "@/components/ui/skeleton";

const TIMELINE_WIDTHS = [72, 58, 64, 46, 68, 52];
const ROW_WIDTHS = [20, 28, 16, 24];
// The profile's cards, About, Fields and Tags, by their number of rows.
const CARD_ROWS = [4, 3, 1];

export default function Loading() {
	return (
		<div aria-hidden="true">
			<div className="mb-6 flex flex-wrap items-center justify-between gap-x-6 gap-y-4">
				<div className="flex items-center gap-2">
					<span className="-ml-2 size-9 shrink-0" />
					<Skeleton className="size-14 shrink-0 rounded-full" />
					<div className="ml-2 flex flex-col gap-2">
						<Skeleton className="h-6 w-40" />
						<Skeleton className="h-3.5 w-52" />
					</div>
				</div>
				<div className="flex gap-2">
					<Skeleton className="h-9 w-24 rounded-lg" />
					<Skeleton className="h-9 w-28 rounded-lg" />
					<Skeleton className="size-9 rounded-lg" />
				</div>
			</div>
			<div className="flex flex-col gap-6">
				<div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
					<div className="flex min-h-52 items-center justify-between gap-6 rounded-xl bg-card p-4 shadow-border">
						<div className="flex flex-col gap-2.5 self-end">
							<Skeleton className="h-4 w-6" />
							<Skeleton className="h-6 w-36" />
							<Skeleton className="h-2.5 w-28" />
						</div>
						<Skeleton className="size-44 shrink-0 rounded-full" />
					</div>
					<div className="grid grid-cols-2 gap-3 md:grid-cols-4 lg:grid-cols-2">
						{Array.from({ length: 4 }, (_, index) => (
							<div key={index} className="flex flex-col gap-2.5 rounded-xl bg-card p-4 shadow-border">
								<Skeleton className="h-3 w-20" />
								<Skeleton className="h-6 w-14" />
								<Skeleton className="h-2.5 w-16" />
							</div>
						))}
					</div>
				</div>
				<div className="grid grid-cols-1 items-start gap-6 md:grid-cols-2 lg:grid-cols-3">
					{CARD_ROWS.map((rows, card) => (
						<div key={card} className="rounded-xl bg-card shadow-border">
							<div className="flex h-12 items-center px-4">
								<Skeleton className="h-3.5 w-16" />
							</div>
							<div className="divide-y divide-border/60 border-t border-border/60">
								{ROW_WIDTHS.slice(0, rows).map((width, row) => (
									<div key={row} className="flex justify-between px-4 py-3">
										<Skeleton className="h-3 w-16" />
										<Skeleton className="h-3" style={{ width: `${width * 4}px` }} />
									</div>
								))}
							</div>
						</div>
					))}
				</div>
				<div className="rounded-xl bg-card shadow-border">
					<div className="flex h-12 items-center px-4">
						<Skeleton className="h-3.5 w-16" />
					</div>
					<div className="flex flex-col gap-5 border-t border-border/60 p-4">
						{TIMELINE_WIDTHS.map((width, index) => (
							<div key={index} className="flex items-center gap-3">
								<Skeleton className="size-7 shrink-0 rounded-full" />
								<Skeleton className="h-3.5" style={{ width: `${width}%` }} />
								<Skeleton className="ml-auto h-3 w-10" />
							</div>
						))}
					</div>
				</div>
			</div>
		</div>
	);
}
