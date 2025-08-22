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
	/**
	 * Optional Zod schema used to validate the request body for this step.
	 * If omitted, the handler receives the raw body without validation.
	 */
	input?: ZodSchema<Schema>;
	/**
	 * The function executed for this step. Receives the validated body (if an
	 * `input` schema is provided) and the endpoint context. Can be async and
	 * should return the step result.
	 */
	handler: ActionEndpointContext<Schema, Result>;
	/**
	 * If true, this step can be completed only once per user. Subsequent
	 * attempts should be treated as no-ops or rejected.
	 */
	once?: boolean;
	/**
	 * If true, this step must be completed before onboarding is considered done.
	 */
	required?: boolean;
};
