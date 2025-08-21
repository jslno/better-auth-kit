import type { OnboardingOptions } from "./types";
import type { BetterAuthPlugin } from "better-auth";
import { mergeSchema } from "better-auth/db";
import { schema } from "./schema";
import { ONBOARDING_ERROR_CODES } from "./error-codes";
import { createAuthMiddleware } from "better-auth/api";
import { shouldOnboard } from "./routes/should-onboard";
import { completeOnboarding } from "./routes/complete-onboard";

export const onboarding = <Schema extends Record<string, any>>(
	options: OnboardingOptions<Schema>,
) => {
	const opts = {
		autoEnableOnSignUp: true,
		...options,
	};

	return {
		id: "onboarding",
		endpoints: {
			shouldOnboard,
			completeOnboarding: completeOnboarding(opts),
		},
		hooks: {
			after: [
				{
					matcher(context) {
						return context.path === "/get-session";
					},
					handler: createAuthMiddleware(async (ctx) => {
						const data = ctx.context.session;

						if (!data?.user.shouldOnboard) {
							return null;
						}

						return ctx.json({
							onboardingRedirect: true,
						});
					}),
				},
				{
					matcher(context) {
						return (
							opts.autoEnableOnSignUp && context.path.startsWith("/sign-up")
						);
					},
					handler: createAuthMiddleware(async (ctx) => {
						const data = ctx.context.newSession;
						if (!data) {
							return null;
						}
						await ctx.context.adapter.update({
							model: "user",
							where: [
								{
									field: "id",
									value: data.user.id,
								},
							],
							update: {
								shouldOnboard: true,
							},
						});

						return ctx.json({
							onboardingRedirect: true,
						});
					}),
				},
			],
		},
		rateLimit: [
			{
				pathMatcher(path) {
					return path.startsWith("/onboarding/");
				},
				window: 10,
				max: 3,
			},
		],
		schema: mergeSchema(schema, opts?.schema),
		$ERROR_CODES: ONBOARDING_ERROR_CODES,
	} satisfies BetterAuthPlugin;
};

export * from "./types";
export * from "./client";
