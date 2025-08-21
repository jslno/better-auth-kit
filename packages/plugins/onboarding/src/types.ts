import type {
	AuthContext,
	EndpointContext,
	InferOptionSchema,
} from "better-auth";
import type { ZodSchema } from "zod";
import type { schema } from "./schema";

type ActionEndpointContext<Schema extends Record<string, any>> = (
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

export type OnboardingOptions<Schema extends Record<string, any>> = {
	input: ZodSchema<Schema>;
	onComplete: ActionEndpointContext<Schema>;
	autoEnableOnSignUp?: boolean;
	schema?: InferOptionSchema<typeof schema>;
};
