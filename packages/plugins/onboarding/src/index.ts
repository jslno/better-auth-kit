import type { BetterAuthPlugin, PrettifyDeep } from "better-auth";
import { mergeSchema } from "better-auth/db";
import { schema } from "./schema";
import { ONBOARDING_ERROR_CODES } from "./error-codes";
import {
	createAuthEndpoint,
	createAuthMiddleware,
	APIError,
	sessionMiddleware,
} from "better-auth/api";
import { shouldOnboard } from "./routes/should-onboard";
import type { OnboardingOptions, OnboardingStep } from "./types";
import type {
	CanAccessOnboardingStepReturnType,
	Merged,
	OnboardingStepReturnType,
	OnboardingStepsToEndpoints,
} from "./internal-types";
import { transformClientPath, transformPath } from "./utils";
import { verifyOnboarding } from "./verify-onboarding";
import { z } from "zod";

export const onboarding = <Steps extends Record<string, OnboardingStep>>(
	options: OnboardingOptions<Steps>,
) => {
	const opts = {
		autoEnableOnSignUp: true,
		...options,
	};

	const endpoints = Object.fromEntries(
		Object.entries(options.steps).flatMap(([id, step]) => {
			const isCompletionStep = options.completionStep === id;
			const key = transformPath(id);
			const path = transformClientPath(id);

			const entries = Object.entries({
				[`onboardingStep${key}`]: createAuthEndpoint(
					`/onboarding/step/${path}`,
					{
						method: "POST",
						body: step.input,
						use: [sessionMiddleware],
					},
					async (ctx): Promise<OnboardingStepReturnType<typeof step>> => {
						const { session } = await verifyOnboarding(ctx);

						const completedSteps = new Set<string>(
							JSON.parse(
								(
									await ctx.context.adapter.findOne<{
										completedSteps?: string;
									}>({
										model: "user",
										where: [
											{
												field: "id",
												value: session.user.id,
											},
										],
										select: ["completedSteps"],
									})
								)?.completedSteps ?? "[]",
							),
						);

						if (step.once && completedSteps.has(id)) {
							throw new APIError("FORBIDDEN", {
								message: ONBOARDING_ERROR_CODES.STEP_ALREADY_COMPLETED,
							});
						}

						const result = await step.handler(ctx);

						const updatedSteps = [...completedSteps.add(id)];
						const update: Record<string, any> = {
							completedSteps: JSON.stringify(updatedSteps),
						};

						if (isCompletionStep) {
							update.shouldOnboard = false;
						}

						await ctx.context.adapter.update({
							model: "user",
							where: [
								{
									field: "id",
									value: session.user.id,
								},
							],
							update,
						});

						return {
							completedSteps: updatedSteps,
							data: result,
						};
					},
				),
				[`canAccessOnboardingStep${key}`]: createAuthEndpoint(
					`/onboarding/can-access-step/${path}`,
					{
						method: "GET",
						use: [sessionMiddleware],
						metadata: {
							SERVER_ONLY: true,
						},
					},
					async (
						ctx,
					): Promise<CanAccessOnboardingStepReturnType<typeof step>> => {
						const { session } = await verifyOnboarding(ctx);

						if (step.once) {
							const { completedSteps } =
								(await ctx.context.adapter.findOne<{
									completedSteps?: string[];
								}>({
									model: "user",
									where: [
										{
											field: "id",
											value: session.user.id,
										},
									],
									select: ["completedSteps"],
								})) ?? {};

							if (completedSteps?.includes(id)) {
								throw new APIError("FORBIDDEN", {
									message: ONBOARDING_ERROR_CODES.STEP_ALREADY_COMPLETED,
								});
							}
						}

						return true;
					},
				),
			});

			return entries;
		}),
	) as PrettifyDeep<Merged<OnboardingStepsToEndpoints<Steps>>>;

	return {
		id: "onboarding",
		endpoints: {
			shouldOnboard,
			...endpoints,
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
		$Infer: {
			OnboardingSteps: {} as Steps,
		},
	} satisfies BetterAuthPlugin;
};

export const createOnboardingStep = <
	Schema extends Record<string, any> | undefined | null,
	Result = unknown,
>(
	def: OnboardingStep<Schema, Result>,
) => {
	return {
		once: true,
		input: z.record(z.any()).nullish(),
		...def,
	};
};

export * from "./types";
export * from "./client";
