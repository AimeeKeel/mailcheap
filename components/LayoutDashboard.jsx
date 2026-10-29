import { cookies } from "next/headers";
import { Suspense } from "react";
import BannerBlocked from "@/components/BannerBlocked";
import BannerPlan from "@/components/BannerPlan";
import ButtonNotifications from "@/components/ButtonNotifications";
import MenuUser from "@/components/MenuUser";
import NavMobile from "@/components/NavMobile";
import NavNewsletter from "@/components/NavNewsletter";
import NavSidebar from "@/components/NavSidebar";
import PanelGetStarted from "@/components/PanelGetStarted";
import PanelInboxCheck from "@/components/PanelInboxCheck";
import ProviderNotifications from "@/components/ProviderNotifications";
import ProviderPaywall from "@/components/ProviderPaywall";
import { Skeleton } from "@/components/ui/skeleton";
import { MenuItems, SiteAnalytics, SupportChat, WhatsNew } from "@/components/SiteExtensions";
import { getSendingStatus, hasActiveSubscription, isBlocked } from "@/lib/account-state";
import { runAction } from "@/lib/actions/run-action";
import { isCloud } from "@/lib/config";
import { gravatarHash } from "@/lib/gravatar";
import { getRecommendedPlanId } from "@/lib/onboarding";
import { PLANS } from "@/lib/plans";
import { getPricing } from "@/lib/pricing";
import { SIDEBAR_COLLAPSED, SIDEBAR_COOKIE } from "@/lib/sidebar";
import { siteExtensions } from "@/lib/site-extensions";
import { findPlansOnSale } from "@/lib/stripe";

export default async function LayoutDashboard({ user, account, isAdmin, children }) {
	const hasPlan = hasActiveSubscription(account);
	// Only an account without a plan sees plans here, in the paywall and the banner, so only then is Stripe read. The
	// bell's first page is the one its server action answers; one that fails leaves it empty until its next look.
	const [plans, notifications] = await Promise.all([
		hasPlan ? PLANS : findPlansOnSale(),
		runAction("list_notifications", { account, user, via: "dashboard" }).catch(() => null),
	]);
	const isSidebarCollapsed = (await cookies()).get(SIDEBAR_COOKIE)?.value === SIDEBAR_COLLAPSED;
	const menu = (
		<MenuUser
			name={user.name}
			email={user.email}
			image={user.image}
			gravatarHash={gravatarHash(user.email)}
			status={getSendingStatus(account)}
			hasBilling={isCloud()}
			items={isCloud() && MenuItems ? <MenuItems /> : null}
		/>
	);

	return (
		<ProviderPaywall hasPlan={hasPlan} pricing={getPricing(getRecommendedPlanId(account, plans), plans)}>
			<ProviderNotifications initial={notifications} supportChatPath={siteExtensions.supportChatPath}>
				{isBlocked(account) ? <BannerBlocked account={account} /> : isCloud() && !hasPlan && <BannerPlan account={account} plans={plans} />}
				<div className="flex min-h-[calc(100dvh-var(--plan-bar-height))] flex-col md:flex-row">
					<NavSidebar
						isCollapsed={isSidebarCollapsed}
						isAdmin={isAdmin}
						switcher={
							<Suspense fallback={<Skeleton className="h-11 rounded-xl" />}>
								<NavNewsletter />
							</Suspense>
						}
						notifications={<ButtonNotifications variant="sidebar" />}
						footer={menu}
					/>
					<NavMobile
						isAdmin={isAdmin}
						switcher={
							<Suspense fallback={<Skeleton className="h-8 w-32 rounded-lg" />}>
								<NavNewsletter isCompact />
							</Suspense>
						}
						notifications={<ButtonNotifications variant="header" />}
						footer={menu}
					/>
					<main className="min-w-0 flex-1">
						{/* The campaign editor takes the whole width: its top bar runs across it, and it centers its own column. */}
						<div className="mx-auto w-full max-w-6xl px-4 py-6 has-[[data-campaign-steps]]:max-w-none md:px-10 md:py-10">{children}</div>
					</main>
				</div>
			</ProviderNotifications>
			<Suspense fallback={null}>
				<PanelGetStarted account={account} />
			</Suspense>
			<Suspense fallback={null}>
				<PanelInboxCheck account={account} />
			</Suspense>
			{WhatsNew && (
				<Suspense fallback={null}>
					<WhatsNew account={account} />
				</Suspense>
			)}
			{SupportChat && (
				<Suspense fallback={null}>
					<SupportChat user={user} account={account} />
				</Suspense>
			)}
			{SiteAnalytics && <SiteAnalytics />}
		</ProviderPaywall>
	);
}
