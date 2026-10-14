import { PricingNote } from "@/components/SiteExtensions";
import SliderPricing from "@/components/SliderPricing";
import TextContactUs from "@/components/TextContactUs";
import { getPricing } from "@/lib/pricing";

// The plans on the public pages and the billing page: a slider across them, with what every plan includes and the
// marketing site's note. initialPlanId and initialPeriod: where the slider starts, on the billing page the plan an
// account's list fits.
export default function ListPricing({ initialPlanId, initialPeriod }) {
	return (
		<div className="flex flex-col gap-4">
			<SliderPricing {...getPricing(initialPlanId)} initialPeriod={initialPeriod}>
				{PricingNote && <PricingNote />}
			</SliderPricing>
			<TextContactUs className="mt-4" />
		</div>
	);
}
