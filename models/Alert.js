import mongoose from "mongoose";

// One document per alert kind: lastSentAt enforces the cooldown between repeated alerts.
const alertSchema = new mongoose.Schema(
	{
		key: { type: String, required: true, unique: true },
		title: { type: String },
		lastSentAt: { type: Date },
	},
	{ timestamps: true }
);

export default mongoose.models.Alert || mongoose.model("Alert", alertSchema);
