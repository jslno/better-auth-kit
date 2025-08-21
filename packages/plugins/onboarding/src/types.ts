import type {
	AuthContext,
	EndpointContext,
	InferOptionSchema,
} from "better-auth";
import type { ZodSchema } from "zod";
import type { schema } from "./schema";

type ActionEndpointContext<
	Schema extends Record<string, any> = Record<string, any>,
> = (
	ctx: EndpointContext<
		string,
		{
			body: ZodSchema<Schema>;
			method: "POST";
		}
	> & {
		context: AuthContext;
	},
) => boolean | Promise<boolean>;

export type OnboardingOptions<
	Schema extends Record<string, any> = Record<string, any>,
> = {
	/**
	 * Zod schema for validating the onboarding input data
	 */
	input: ZodSchema<Schema>;
	/**
	 * Function that gets executed when onboarding is completed
	 * @param ctx The endpoint context containing the request body and auth context
	 * @returns boolean indicating if the onboarding completion was successful
	 */
	onComplete: ActionEndpointContext<Schema>;
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
