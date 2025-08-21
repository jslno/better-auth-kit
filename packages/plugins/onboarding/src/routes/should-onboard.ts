import { sessionMiddleware } from "better-auth/api";
import { createAuthEndpoint } from "better-auth/plugins";
import { verifyOnboarding } from "../verify-onboarding";

export const shouldOnboard = createAuthEndpoint(
	"/onboarding/should-onboard",
	{
		method: "GET",
		use: [sessionMiddleware],
	},
	async (ctx) => {
		await verifyOnboarding(ctx);

		return true;
	},
);
