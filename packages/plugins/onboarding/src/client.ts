import type { BetterAuthClientPlugin } from "better-auth";
import type { onboarding, OnboardingStep } from ".";

type InferSteps<T> = T extends {
	$Infer: {
		OnboardingSteps: infer Steps extends Record<string, OnboardingStep>;
	};
}
	? Steps
	: T extends Record<string, OnboardingStep>
		? T
		: never;

export const onboardingClient = <
	Steps extends
		| {
				$Infer: {
					OnboardingSteps: Record<string, OnboardingStep>;
				};
		  }
		| Record<string, OnboardingStep>,
>(options?: {
	/**
	 * a redirect function to call if a user needs
	 * to be onboarded
	 */
	onOnboardingRedirect?: () => void | Promise<void>;
}) => {
	return {
		id: "onboarding",
		$InferServerPlugin: {} as ReturnType<typeof onboarding<InferSteps<Steps>>>,
		atomListeners: [
			{
				matcher: (path) => path.startsWith("/onboarding/"),
				signal: "$sessionSignal",
			},
		],

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
					async onRequest(context) {
						if (
							!new URL(context.url).pathname.startsWith(
								`${new URL(context.baseURL ?? "/api/auth").pathname}/onboarding/step`,
							)
						) {
							return;
						}

						return {
							...context,
							method: "POST",
						};
					},
				},
			},
		],
	} satisfies BetterAuthClientPlugin;
};
