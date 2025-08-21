import type { BetterAuthClientPlugin, BetterAuthPlugin } from "better-auth";
import type { onboarding } from ".";
import type { ZodSchema } from "zod";

type InferSchema<T> = T extends {
	$Infer: {
		OnboardingInput: infer Schema extends Record<string, any>;
	};
}
	? Schema
	: T extends Record<string, any>
		? T
		: never;

export const onboardingClient = <Schema extends Record<string, any>>(options?: {
	/**
	 * Zod schema for validating the onboarding input data
	 */
	input?: ZodSchema<InferSchema<Schema>>;
	/**
	 * a redirect function to call if a user needs
	 * to be onboarded
	 */
	onOnboardingRedirect?: () => void | Promise<void>;
}) => {
	return {
		id: "onboarding",
		$InferServerPlugin: {} as ReturnType<
			typeof onboarding<InferSchema<Schema>>
		>,
		atomListeners: [
			{
				matcher: (path) => path.startsWith("/onboarding/"),
				signal: "$sessionSignal",
			},
		],
		pathMethods: {
			"/onboarding/complete": "POST",
			"/onboarding/should-onboard": "GET",
		},
		fetchPlugins: [
			{
				id: "onboarding",
				name: "onboarding",
				hooks: {
					async onSuccess(context) {
						if (context.data?.onboardingRedirect) {
							if (options?.onOnboardingRedirect) {
								await options.onOnboardingRedirect();
							}
						}
					},
				},
			},
		],
	} satisfies BetterAuthClientPlugin;
};
