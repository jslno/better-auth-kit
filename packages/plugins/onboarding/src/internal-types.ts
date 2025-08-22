import type { createAuthEndpoint, sessionMiddleware } from "better-auth/api";
import type { OnboardingStep } from "./types";
import type { ZodSchema } from "zod";
import type { TransformClientPath, TransformPath } from "./utils";

type InferStepInput<K extends OnboardingStep> = K extends { input?: infer I }
	? I extends ZodSchema<any>
		? I
		: never
	: never;

type InferStepResult<K extends OnboardingStep> = K extends OnboardingStep<
	any,
	infer R
>
	? R
	: never;

export type OnboardingStepReturnType<K extends OnboardingStep = any> = {
	completedSteps: string[];
	data: InferStepResult<K>;
};

export type CanAccessOnboardingStepReturnType<K extends OnboardingStep = any> =
	boolean;

export type EndpointPair<Path extends string, K extends OnboardingStep> = {
	onboardingStep: ReturnType<
		typeof createAuthEndpoint<
			`/onboarding/step/${TransformClientPath<Path>}`,
			{
				method: "POST";
				body: InferStepInput<K>;
				use: [typeof sessionMiddleware],
			},
			OnboardingStepReturnType<K>
		>
	>;
	canAccessOnboardingStep: ReturnType<
		typeof createAuthEndpoint<
			`/onboarding/can-access-step/${TransformClientPath<Path>}`,
			{
				method: "GET";
				use: [typeof sessionMiddleware],
				metadata: {
					SERVER_ONLY: true;
				};
			},
			CanAccessOnboardingStepReturnType<K>
		>
	>;
};

type PrefixedEndpoints<Path extends string, S extends OnboardingStep> = {
	[K in keyof EndpointPair<
		Path,
		S
	> as `${Extract<K, string>}${TransformPath<Path>}`]: EndpointPair<Path, S>[K];
};

export type OnboardingStepsToEndpoints<
	S extends Record<string, OnboardingStep<any>>,
> = {
	[K in keyof S & string]: PrefixedEndpoints<K, S[K]>;
};

export type Merged<T> = {
	[K in keyof T]: T[K];
}[keyof T];
