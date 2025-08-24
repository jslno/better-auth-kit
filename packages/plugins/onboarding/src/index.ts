import type { BetterAuthPlugin, PrettifyDeep } from "better-auth";
import { mergeSchema } from "better-auth/db";
import { schema } from "./schema";
import { ONBOARDING_ERROR_CODES } from "./error-codes";
import {
	createAuthEndpoint,
	createAuthMiddleware,
	APIError,
	sessionMiddleware,
	type AuthEndpoint,
} from "better-auth/api";
import { shouldOnboard } from "./routes/should-onboard";
import type { OnboardingOptions, OnboardingStep } from "./types";
import type {
	CanAccessOnboardingStepReturnType,
	InferSkipCompletionStep,
	Merged,
	OnboardingStepReturnType,
	OnboardingStepsToEndpoints,
	SkipOnboardingStepReturnType,
} from "./internal-types";
import { transformClientPath, transformPath } from "./utils";
import { verifyOnboarding } from "./verify-onboarding";

export const onboarding = <
	Steps extends Record<string, OnboardingStep<any, any, any>>,
	CompletionStep extends keyof Steps,
>(
	options: OnboardingOptions<Steps, CompletionStep>,
) => {
	const opts = {
		autoEnableOnSignUp: true,
		...options,
	};

	const steps = Object.entries(options.steps);

	const requiredSteps = steps.filter(([_, step]) => step.required);
	const endpoints = Object.fromEntries(
		steps.flatMap(([id, step]) => {
			const isCompletionStep = options.completionStep === id;
			const key = transformPath(id);
			const path = transformClientPath(id);

			const endpoints: Record<string, AuthEndpoint> = {
				[`onboardingStep${key}`]: createAuthEndpoint(
					`/onboarding/step/${path}`,
					{
						method: "POST",
						body: step.input,
						use: [sessionMiddleware],
						requireHeaders: step.requireHeaders,
						requireRequest: step.requireRequest,
						cloneRequest: step.cloneRequest,
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

						if (
							isCompletionStep &&
							requiredSteps
								.filter(([key]) => key !== id)
								.some(([key]) => !completedSteps.has(key))
						) {
							throw new APIError("FORBIDDEN", {
								message:
									ONBOARDING_ERROR_CODES.COMPLETE_REQUIRED_STEPS_BEFORE_COMPLETING_ONBOARDING,
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
					async (ctx): Promise<CanAccessOnboardingStepReturnType> => {
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
			};

			if (isCompletionStep && step.required !== true) {
				endpoints[`skipOnboardingStep${key}`] = createAuthEndpoint(
					`/onboarding/skip-step/${path}`,
					{
						method: "POST",
						use: [sessionMiddleware],
					},
					async (ctx): Promise<SkipOnboardingStepReturnType> => {
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

						if (completedSteps.has(id)) {
							throw new APIError("FORBIDDEN", {
								message: ONBOARDING_ERROR_CODES.STEP_ALREADY_COMPLETED,
							});
						}
						if (
							requiredSteps
								.filter(([key]) => key !== id)
								.some(([key]) => !completedSteps.has(key))
						) {
							throw new APIError("FORBIDDEN", {
								message:
									ONBOARDING_ERROR_CODES.COMPLETE_REQUIRED_STEPS_BEFORE_COMPLETING_ONBOARDING,
							});
						}

						await ctx.context.adapter.update({
							model: "user",
							where: [
								{
									field: "id",
									value: session.user.id,
								},
							],
							update: {
								shouldOnboard: false,
							},
						});

						return {
							completedSteps: [...completedSteps],
							data: null,
						};
					},
				);
			}

			return Object.entries(endpoints);
		}),
	) as PrettifyDeep<
		Merged<OnboardingStepsToEndpoints<Steps, CompletionStep>> &
			InferSkipCompletionStep<Steps, CompletionStep>
	>;

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
						const enabled =
							typeof opts.autoEnableOnSignUp === "function"
								? await opts.autoEnableOnSignUp(ctx)
								: opts.autoEnableOnSignUp;

						if (!data || !enabled) {
							return;
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
			OnboardingCompletionStep: {} as CompletionStep,
		},
	} satisfies BetterAuthPlugin;
};

export const createOnboardingStep = <
	Schema extends Record<string, any> | undefined | null,
	Result = unknown,
	Required extends boolean = false,
>(
	def: Omit<OnboardingStep<Schema, Result, Required>, "required"> &
		(Required extends true ? { required: true } : { required?: Required }),
) => {
	return {
		once: true,
		required: (def.required ?? false) as Required,
		...def,
	};
};

export * from "./types";
export * from "./client";
