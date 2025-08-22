import {
	onboarding,
	type OnboardingOptions,
	createOnboardingStep,
} from "../src";
import { betterAuth, type BetterAuthPlugin } from "better-auth";
import database from "better-sqlite3";
import { z } from "zod";

const onboardingSchema = z
	.object({
		foo: z.string().optional(),
	})
	.nullish();

export const getAuth = (
	options?: Partial<OnboardingOptions>,
	authOptions?: {
		plugins?: BetterAuthPlugin[];
	},
) => {
	const auth = betterAuth({
		database: database(":memory:"),
		emailAndPassword: {
			enabled: true,
		},
		plugins: [
			onboarding({
				steps: {
					newPassword: createOnboardingStep({
						input: onboardingSchema,
						handler: async (ctx) => {
							return true;
						},
					}),
				},
				completionStep: "newPassword",
				...options,
			}),
			...(authOptions?.plugins ?? []),
		],
	});

	return auth;
};
