import type { GenericEndpointContext, InferOptionSchema } from "better-auth";
import type { ZodSchema } from "zod";
import type { schema } from "./schema";

type ActionEndpointContext<Schema = unknown, Result = unknown> = (
	ctx: Omit<GenericEndpointContext, "body"> & {
		body: Schema;
	},
) => Result | Promise<Result>;

export type OnboardingOptions<
	Steps extends Record<string, OnboardingStep> = any,
> = {
	/**
	 * Map of onboarding steps keyed by a unique step identifier.
	 */
	steps: Steps;
	/**
	 * The key of the step that, when completed, marks onboarding as finished.
	 */
	completionStep: keyof Steps;
	/**
	 * Whether to automatically enable onboarding for new users during sign up
	 * @default true
	 */
	autoEnableOnSignUp?: boolean;
	/**
	 * Custom schema configuration for the onboarding plugin
	 */
	schema?: InferOptionSchema<typeof schema>;
};

export type OnboardingStep<
	Schema extends Record<string, any> | undefined | null = any,
	Result = unknown,
> = {
	input?: ZodSchema<Schema>;
	handler: ActionEndpointContext<Schema, Result>;
	once?: boolean;
};
