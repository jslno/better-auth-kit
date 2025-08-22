import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { getAuth } from "../auth";
import { setup2FAStep } from "../../src/presets/setup-2fa";
import { getTestInstance } from "@better-auth-kit/tests";
import { onboardingClient } from "../../src";
import { ONBOARDING_ERROR_CODES } from "../../src/error-codes";
import { twoFactor } from "better-auth/plugins";

// describe("setup-2fa preset", async () => {
// 	const auth = getAuth(
// 		{
// 			steps: {
// 				twoFactor: setup2FAStep({ required: false }),
// 			},
// 			completionStep: "twoFactor",
// 		},
// 		{
// 			plugins: [twoFactor()],
// 		},
// 	);

// 	const { resetDatabase, client, signUpWithTestUser, db, testUser } =
// 		await getTestInstance(auth, {
// 			clientOptions: {
// 				plugins: [onboardingClient()],
// 			},
// 			shouldRunMigrations: true,
// 		});

// 	let headers: Headers;
// 	beforeAll(async () => {
// 		await resetDatabase();
// 		const result = await signUpWithTestUser();
// 		headers = result.headers;
// 	});

// 	beforeEach(async () => {
// 		await db.update({
// 			model: "user",
// 			where: [
// 				{
// 					field: "email",
// 					value: testUser.email,
// 				},
// 			],
// 			update: {
// 				shouldOnboard: true,
// 				completedSteps: "[]",
// 			},
// 		});
// 	});

// 	it("should validate required password field", async () => {
// 		const res = await (client.onboarding as any).step.twoFactor({
// 			password: "",
// 			fetchOptions: { headers },
// 		});
// 		expect(res.error?.status).toBe(400);
// 	});

// 	it("should accept optional issuer field", async () => {
// 		const res = await (client.onboarding as any).step.twoFactor({
// 			password: "testpassword",
// 			issuer: "TestApp",
// 			fetchOptions: { headers },
// 		});
// 		console.log(res);
// 		expect(res.error?.status).toBe(404);
// 	});

// it("should enforce once constraint for 2FA setup", async () => {
// 	// First attempt (will fail due to missing 2FA plugin, but step is recorded)
// 	await (client.onboarding as any).step.twoFactor({
// 		password: "testpassword",
// 		fetchOptions: { headers },
// 	});

// 	// Try to complete again
// 	const res = await (client.onboarding as any).step.twoFactor({
// 		password: "testpassword",
// 		fetchOptions: { headers },
// 	});
// 	expect(res.error?.status).toBe(403);
// 	expect(res.error?.message).toBe(
// 		ONBOARDING_ERROR_CODES.STEP_ALREADY_COMPLETED,
// 	);
// });

// it("should handle missing 2FA plugin gracefully", async () => {
// 	const res = await (client.onboarding as any).step.twoFactor({
// 		password: "testpassword",
// 		fetchOptions: { headers },
// 	});
// 	expect(res.error?.status).toBe(404);
// });
//});

describe("setup-new-password preset", async () => {
	const auth = getAuth(
		{
			steps: {
				twoFactor: setup2FAStep({ required: false }),
				complete: {
					async handler(ctx) {
						return true;
					},
				},
			},
			completionStep: "complete",
		},
		{
			plugins: [twoFactor()],
		},
	);

	const { resetDatabase, client, signUpWithTestUser, db, testUser } =
		await getTestInstance(auth, {
			clientOptions: {
				plugins: [onboardingClient()],
			},
			shouldRunMigrations: true,
		});

	let headers: Headers;
	beforeAll(async () => {
		await resetDatabase();
		const result = await signUpWithTestUser();
		headers = result.headers;
	});

	beforeEach(async () => {
		await db.update({
			model: "user",
			where: [
				{
					field: "email",
					value: testUser.email,
				},
			],
			update: {
				shouldOnboard: true,
				completedSteps: "[]",
			},
		});
	});

	it("should validate required password field", async () => {
		const res = await (client.onboarding as any).step.twoFactor({
			password: "",
			fetchOptions: { headers },
		});
		expect(res.error?.status).toBe(400);
	});

	it("should accept optional issuer field", async () => {
		const res = await (client.onboarding as any).step.twoFactor({
			password: testUser.password,
			issuer: "TestApp",
			fetchOptions: { headers },
		});
		expect(res.data?.completedSteps).includes("twoFactor");
	});

	it("should enforce once constraint for 2FA setup", async () => {
		await (client.onboarding as any).step.twoFactor({
			password: testUser.password,
			fetchOptions: { headers },
		});

		const res = await (client.onboarding as any).step.twoFactor({
			password: testUser.password,
			fetchOptions: { headers },
		});
		expect(res.error?.status).toBe(403);
		expect(res.error?.message).toBe(
			ONBOARDING_ERROR_CODES.STEP_ALREADY_COMPLETED,
		);
	});
});
