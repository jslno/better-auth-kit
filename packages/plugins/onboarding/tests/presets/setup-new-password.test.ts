import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { getAuth } from "../auth";
import { setupNewPasswordStep } from "../../src/presets/setup-new-password";
import { getTestInstance } from "@better-auth-kit/tests";
import { onboardingClient } from "../../src";

describe("setup-new-password preset", async () => {
	const auth = getAuth({
		steps: {
			newPassword: setupNewPasswordStep({ required: true }),
		},
		completionStep: "newPassword",
	});

	const { resetDatabase, client, signUpWithTestUser, db, testUser } =
		await getTestInstance(auth, {
			clientOptions: {
				plugins: [
					onboardingClient(),
				],
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

	it("should validate password and confirmPassword match", async () => {
		const res = await (client.onboarding as any).step.newPassword({
			newPassword: "newpassword123",
			confirmPassword: "differentpassword",
			fetchOptions: { headers },
		});
		expect(res.error?.status).toBe(400);
		expect(res.error?.message).toContain("Invalid body parameters");
	});

	it("should successfully update password when passwords match", async () => {
		const res = await (client.onboarding as any).step.newPassword({
			newPassword: "newpassword123",
			confirmPassword: "newpassword123",
			fetchOptions: { headers },
		});
		if (res.error) throw res.error;
		expect(res.data.data.success).toBe(true);
		expect(res.data.completedSteps).toEqual(["newPassword"]);
	});

	it("should mark step as completed and finish onboarding", async () => {
		const res = await (client.onboarding as any).step.newPassword({
			newPassword: "newpassword123",
			confirmPassword: "newpassword123",
			fetchOptions: { headers },
		});
		if (res.error) throw res.error;

		const { data: shouldOnboard } = await client.onboarding.shouldOnboard({
			fetchOptions: { headers },
		});
		expect(shouldOnboard).not.toBe(true);
	});

	it("should enforce once constraint for password setup", async () => {
		await (client.onboarding as any).step.newPassword({
			newPassword: "newpassword123",
			confirmPassword: "newpassword123",
			fetchOptions: { headers },
		});

		const res = await (client.onboarding as any).step.newPassword({
			newPassword: "anotherpassword123",
			confirmPassword: "anotherpassword123",
			fetchOptions: { headers },
		});
		expect(res.error?.status).toBe(403);
		expect(res.error?.message).toBeDefined();
	});
});
