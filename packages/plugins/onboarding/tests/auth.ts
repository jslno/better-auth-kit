import {
	onboarding,
	type OnboardingOptions,
	createOnboardingStep,
} from "../src";
import { betterAuth } from "better-auth";
import database from "better-sqlite3";
import { z } from "zod";

const db = database("test.db");
const onboardingSchema = z
	.object({
		foo: z.string().optional(),
	})
	.nullish();

export const getAuth = (options?: Partial<OnboardingOptions>) => {
	const auth = betterAuth({
		database: db,
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
		],
	});

	return auth;
};
