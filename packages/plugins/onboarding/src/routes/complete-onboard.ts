import {
	createAuthEndpoint,
	sessionMiddleware,
	APIError,
} from "better-auth/api";
import { verifyOnboarding } from "../verify-onboarding";
import type { OnboardingOptions } from "../types";
import { ONBOARDING_ERROR_CODES } from "../error-codes";

export const completeOnboarding = <Schema extends Record<string, any>>(
	options: OnboardingOptions<Schema>,
) =>
	createAuthEndpoint(
		"/onboarding/complete",
		{
			method: "POST",
			body: options.input,
			use: [sessionMiddleware],
		},
		async (ctx) => {
			const { valid } = await verifyOnboarding(ctx);

			if (await options.onComplete(ctx)) {
				await ctx.context.adapter.update({
					model: "user",
					where: [
						{
							field: "id",
							value: ctx.context.session.user.id,
						},
					],
					update: {
						shouldOnboard: false,
					},
				});
				return valid(ctx);
			}

			throw new APIError("BAD_REQUEST", {
				message: ONBOARDING_ERROR_CODES.FAILED_TO_COMPLETE_ONBOARDING,
			});
		},
	);
