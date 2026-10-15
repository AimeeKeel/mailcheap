import Link from "next/link";
import LogoMailcheap from "@/components/LogoMailcheap";
import { cn } from "@/lib/utils";

// canFly: hovering the wordmark flies its plane around a loop (app/globals.css), for the public site's header.
export default function LogoWordmark({ href, canFly, className, children }) {
	const Wordmark = href ? Link : "span";

	return (
		<Wordmark href={href} className={cn("flex items-center gap-2", canFly && "wordmark-flight", className)}>
			{canFly ? <LogoFlight /> : <LogoMailcheap />}
			<span className="text-[17px] font-semibold tracking-tight">MailCheap</span>
			{children}
		</Wordmark>
	);
}

// The loop's numbers are in this box, the plane's own 24 px: offset-path measures from the box around an element.
function LogoFlight() {
	return (
		<span style={{ "--wordmark-loop": `path("${LOOP}")` }} className="relative grid shrink-0">
			<span aria-hidden="true" className="wordmark-trail pointer-events-none absolute inset-0 text-foreground/30">
				{TRAIL.map(({ distance, at }) => (
					<span
						key={distance}
						style={{ "--distance": `${distance}%`, "--at": at }}
						className="wordmark-trail-dash absolute top-0 left-0 h-[1.5px] w-[2.5px] rounded-full bg-current"
					/>
				))}
			</span>
			<LogoMailcheap className="wordmark-plane" />
		</span>
	);
}

// Up and over, behind the plane's spot and back, inside the header's height: 70 px long. It leaves and ends on 1 px of
// straight line along the nose: browsers measure the heading at the ends differently on a curve.
const LOOP = "M12 12L12.743 11.331C17.245 7.278 16.21 1.62 11.34 -2.13C6.48 -5.88 -1.11 -5.64 -5.61 -1.58C-10.12 2.47 -9.82 8.8 -4.96 12.55C-0.09 16.3 6.755 16.722 11.257 12.669L12 12";

// A dashed line along the loop, a dash every 7 px, each showing as the plane passes it. at is that moment as a part
// of the flight: the inverse of its ease-in-out sine.
const TRAIL = Array.from({ length: 10 }, (_, index) => {
	const distance = index * 10 + 5;
	return { distance, at: Math.round((Math.acos(1 - distance / 50) / Math.PI) * 1000) / 1000 };
});
