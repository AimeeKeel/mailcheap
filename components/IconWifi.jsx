// The status bar's Wi-Fi as iOS draws it: a wedge and two arcs fanning out from it.
export default function IconWifi({ className }) {
	return (
		<svg viewBox="0 0 16 12" fill="currentColor" stroke="currentColor" strokeWidth="0.5" strokeLinejoin="round" aria-hidden="true" className={className}>
			<path d="M8 11.25 5.74 8.99a3.2 3.2 0 0 1 4.52 0Z" />
			<path d="M3.26 6.51a6.7 6.7 0 0 1 9.48 0l-1.56 1.56a4.5 4.5 0 0 0-6.36 0Z" />
			<path d="M.79 4.04a10.2 10.2 0 0 1 14.42 0l-1.55 1.55a8 8 0 0 0-11.32 0Z" />
		</svg>
	);
}
