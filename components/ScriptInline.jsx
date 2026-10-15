// Runs while the server's HTML is parsed, before React hydrates. Rendered in the browser, after a navigation inside
// the app, it's plain text, which React neither runs nor warns about.
export default function ScriptInline({ html }) {
	return (
		<script
			type={typeof window === "undefined" ? "text/javascript" : "text/plain"}
			suppressHydrationWarning
			dangerouslySetInnerHTML={{ __html: html }}
		/>
	);
}
