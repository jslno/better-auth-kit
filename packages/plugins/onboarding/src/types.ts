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
	steps: Steps;
	completionStep: keyof Steps;
	/**
	 * Whether to automatically enable onboarding for new users during sign up
	 * @default false
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
