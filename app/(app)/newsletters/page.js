import { AtSign, Bell, BrushCleaning, CodeXml, Globe, Hand, MailCheck, Palette } from "lucide-react";
import AvatarNewsletter from "@/components/AvatarNewsletter";
import CardSettingsSection from "@/components/CardSettingsSection";
import HeaderPage from "@/components/HeaderPage";
import LayoutNarrow from "@/components/LayoutNarrow";
import NoticeInboxCheck from "@/components/NoticeInboxCheck";
import RedirectSettingsField from "@/components/RedirectSettingsField";
import { isInboxCheckShown } from "@/lib/inbox-check";
import { DESIGN_SECTION, FORM_SECTION, NOTIFICATIONS_SECTION, SETTINGS_SECTIONS, getSectionPath } from "@/lib/newsletter-sections";
import { getSettingsPage } from "@/lib/settings-page";
import { getDesignSummary, getSettingsSummary } from "@/lib/settings-summary";
import { getThemeSummary } from "@/lib/themes";

export const metadata = { title: "Settings" };

// The open newsletter's settings at a glance, a card for each section's page; /newsletters/<id> opens another one first.
// Above them, until it's closed, the card that gets MailCheap's own emails into its owner's inbox.
export default async function SettingsPage() {
	const page = await getSettingsPage();
	const { newsletter } = page;
	const summary = getSettingsSummary(page);
	const design = getDesignSummary(getThemeSummary(newsletter));

	return (
		<LayoutNarrow>
			<RedirectSettingsField />
			<HeaderPage title="Settings" />
			{isInboxCheckShown(newsletter) && (
				<NoticeInboxCheck key={String(newsletter._id)} newsletterId={String(newsletter._id)} stagger={1} className="mb-6" />
			)}
			<ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
				{SETTINGS_SECTIONS.map(({ id, label }, index) => (
					<li key={id}>
						<CardSettingsSection
							href={getSectionPath(id)}
							icon={ICONS[id]}
							media={id === "general" ? <AvatarNewsletter newsletter={newsletter} size={40} /> : null}
							label={label}
							state={summary[id]}
							stagger={index + 1}
						/>
					</li>
				))}
				<li>
					<CardSettingsSection
						href={getSectionPath(FORM_SECTION.id)}
						icon={CodeXml}
						label={FORM_SECTION.label}
						state={summary.form}
						stagger={SETTINGS_SECTIONS.length + 1}
					/>
				</li>
				<li>
					<CardSettingsSection
						href={getSectionPath(DESIGN_SECTION.id)}
						icon={Palette}
						label={DESIGN_SECTION.label}
						state={design}
						swatches={design.swatches}
						stagger={SETTINGS_SECTIONS.length + 2}
					/>
				</li>
				{page.isCloud && (
					<li>
						<CardSettingsSection
							href={getSectionPath(NOTIFICATIONS_SECTION.id)}
							icon={Bell}
							label={NOTIFICATIONS_SECTION.label}
							state={summary.notifications}
							stagger={SETTINGS_SECTIONS.length + 3}
						/>
					</li>
				)}
			</ul>
		</LayoutNarrow>
	);
}

const ICONS = { sender: AtSign, signups: MailCheck, welcome: Hand, cleanup: BrushCleaning, website: Globe };
