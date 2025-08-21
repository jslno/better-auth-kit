import { onboarding } from "../src";
import { betterAuth, capitalizeFirstLetter } from "better-auth";
import database from "better-sqlite3";
import { z } from "zod";

const db = database("test.db");
const onboardingSchema = z.object({
	foo: z.string().optional(),
});

export const auth = betterAuth({
	database: db,
	emailAndPassword: {
		enabled: true,
	},
	plugins: [
		onboarding({
			input: onboardingSchema,
			async onComplete(ctx) {
				return true;
			},
		}),
	],
});

export const authFail = betterAuth({
	database: db,
	emailAndPassword: {
		enabled: true,
	},
	plugins: [
		onboarding({
			input: onboardingSchema,
			async onComplete(ctx) {
				return false;
			},
		}),
	],
});
