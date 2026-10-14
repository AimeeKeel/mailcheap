import CardPlan from "@/components/CardPlan";
import TabsInterval from "@/components/TabsInterval";
import TextContactUs from "@/components/TextContactUs";
import { PLANS } from "@/lib/plans";

// current: the plan and interval the account pays for, when it pays. On a free plan every plan opens Checkout.
export default function ListPlans({ interval, current }) {
	return (
		<div className="flex flex-col items-center gap-6">
			<TabsInterval interval={interval} />
			<div className="grid w-full gap-3 sm:grid-cols-2 lg:grid-cols-4">
				{PLANS.map((plan, index) => (
					<CardPlan
						key={plan.id}
						plan={plan}
						interval={interval}
						action={getAction(plan, interval, current)}
						stagger={index + 1}
					/>
				))}
			</div>
			<TextContactUs />
		</div>
	);
}

function getAction(plan, interval, current) {
	if (!current) return "subscribe";
	return plan.id === current.plan && interval === current.interval ? "current" : "switch";
}
