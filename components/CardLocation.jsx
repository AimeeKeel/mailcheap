import ImageFlag from "@/components/ImageFlag";
import ImageGlobe from "@/components/ImageGlobe";
import { getCountryName } from "@/lib/countries";
import { cn } from "@/lib/utils";

// Signups set the country from the form; anyone else gets one from their first click in an email (lib/countries.js).
const SIGNUP_SOURCES = new Set(["website", "embed"]);

// Where a contact is, as far as MailCheap knows: their country on a globe turned to face it. source: how they joined.
export default function CardLocation({ country, source, stagger = 0, className }) {
	const name = getCountryName(country);

	return (
		<section
			style={{ "--stagger": stagger }}
			className={cn("relative isolate min-h-52 overflow-hidden rounded-xl bg-card shadow-border animate-enter", className)}
		>
			<div className="relative z-10 flex h-full max-w-[52%] flex-col justify-between gap-8 p-4 sm:max-w-[56%]">
				<h2 className="text-[13px] text-muted-foreground">Location</h2>
				{name ? (
					<div className="flex flex-col items-start gap-2">
						<ImageFlag country={country} width={22} />
						<p className="text-2xl leading-tight font-semibold tracking-tight text-balance">{name}</p>
						<p className="text-xs text-muted-foreground">
							{SIGNUP_SOURCES.has(source) ? "Where they signed up from" : "Where they first clicked from"}
						</p>
					</div>
				) : (
					<div className="flex flex-col gap-1">
						<p className="font-medium">No location yet</p>
						<p className="text-xs text-pretty text-muted-foreground">
							It shows once they sign up, confirm or click a link in your emails.
						</p>
					</div>
				)}
			</div>
			<div aria-hidden="true" className="pointer-events-none absolute inset-y-2 -right-6 aspect-square sm:-right-4">
				<div className={cn("absolute inset-[18%] rounded-full blur-2xl", name ? "bg-sky-500/15" : "bg-foreground/5")} />
				<ImageGlobe country={name ? country : null} className={cn("relative size-full", !name && "opacity-70")} />
			</div>
		</section>
	);
}
