import { getTestInstance } from "@better-auth-kit/tests";
import { describe, expect, it, vi, beforeAll, beforeEach } from "vitest";
import { onboardingClient } from "../src/client";
import { ONBOARDING_ERROR_CODES } from "../src/error-codes";
import { getAuth } from "./auth";

const mockOnboardingRedirect = vi.fn();
describe("Onboarding", () => {
	describe("(success)", async () => {
		const { resetDatabase, client, signUpWithTestUser, testUser, db } =
			await getTestInstance(getAuth(), {
				clientOptions: {
					plugins: [
						onboardingClient({
							onOnboardingRedirect: mockOnboardingRedirect,
						}),
					],
				},
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
				},
			});
		});

		it("should return true for shouldOnboard when user needs onboarding", async () => {
			const { data, error } = await client.onboarding.shouldOnboard({
				fetchOptions: {
					headers,
				},
			});
			if (error) throw error;
			expect(data).toBe(true);
		});

		it("should trigger redirect via getSession hook", async () => {
			mockOnboardingRedirect.mockClear();
			await client.getSession({
				fetchOptions: {
					headers,
					throw: true,
				},
			});
			expect(mockOnboardingRedirect).toHaveBeenCalled();
		});

		it("should complete onboarding successfully and return sanitized user", async () => {
			const res = await client.onboarding.complete({
				foo: "bar",
				fetchOptions: {
					headers,
				},
			});
			if (res.error) throw res.error;
			await expect(
				db.findOne<{ shouldOnboard?: boolean }>({
					model: "user",
					where: [
						{
							field: "email",
							value: testUser.email,
						},
					],
					select: ["shouldOnboard"],
				}),
			).resolves.toEqual({
				shouldOnboard: false,
			});
			expect(res.data?.user.id).toBeDefined();
			expect(res.data?.user.email).toBeDefined();
		});

		it("should not trigger redirect via getSession after completing onboarding", async () => {
			mockOnboardingRedirect.mockClear();
			await client.onboarding.complete({
				fetchOptions: {
					headers,
				},
			});
			await client.getSession({
				fetchOptions: {
					headers,
					throw: true,
				},
			});
			expect(mockOnboardingRedirect).not.toHaveBeenCalled();
		});

		it("should return unauthorized on shouldOnboard when already onboarded", async () => {
			await client.onboarding.complete({
				fetchOptions: {
					headers,
				},
			});
			const { error } = await client.onboarding.shouldOnboard({
				fetchOptions: {
					headers,
				},
			});
			expect(error?.status).toBe(401);
			expect(error?.message).toBe(ONBOARDING_ERROR_CODES.ALREADY_ONBOARDED);
		});

		it("should fail shouldOnboard without session", async () => {
			const { error } = await client.onboarding.shouldOnboard();
			expect(error?.status).toBe(401);
		});
		it("should fail onboarding without session", async () => {
			const res = await client.onboarding.complete({
				fetchOptions: {
					headers: new Headers(),
				},
			});
			expect(res.error?.status).toBe(401);
		});

		it("should error when already onboarded", async () => {
			await db.update({
				model: "user",
				where: [
					{
						field: "email",
						value: testUser.email,
					},
				],
				update: {
					shouldOnboard: false,
				},
			});
			const res = await client.onboarding.complete({
				fetchOptions: {
					headers,
				},
			});
			expect(res.error?.message).toBe(ONBOARDING_ERROR_CODES.ALREADY_ONBOARDED);
		});
	});

	describe("(failure)", async () => {
		const { resetDatabase, client, signUpWithTestUser, testUser, db } =
			await getTestInstance(
				getAuth({
					autoEnableOnSignUp: true,
					async onComplete(ctx) {
						return false;
					},
				}),
				{
					clientOptions: {
						plugins: [
							onboardingClient({
								onOnboardingRedirect: mockOnboardingRedirect,
							}),
						],
					},
				},
			);

		let headers: Headers;
		beforeAll(async () => {
			await resetDatabase();
			const result = await signUpWithTestUser();
			headers = result.headers;
		});

		it("should reject onboarding when onComplete returns false", async () => {
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
				},
			});
			const result = await client.onboarding.complete({
				fetchOptions: {
					headers,
				},
			});

			expect(result.error?.message).toBe(
				ONBOARDING_ERROR_CODES.FAILED_TO_COMPLETE_ONBOARDING,
			);
		});

		it("should reject onboarding with invalid schema body", async () => {
			const res = await client.onboarding.complete({
				foo: 123,
				fetchOptions: {
					headers,
				},
			});
			expect(res.error?.status).toBe(400);
		});
	});

	describe("(auto enable on sign-up)", async () => {
		const { resetDatabase, signUpWithTestUser } = await getTestInstance(
			getAuth(),
			{
				clientOptions: {
					plugins: [
						onboardingClient({
							onOnboardingRedirect: mockOnboardingRedirect,
						}),
					],
				},
			},
		);

		beforeEach(async () => {
			await resetDatabase();
		});

		it("should trigger redirect during sign-up when autoEnableOnSignUp is true", async () => {
			mockOnboardingRedirect.mockClear();
			await signUpWithTestUser();
			expect(mockOnboardingRedirect).toHaveBeenCalled();
		});

		it("should not trigger redirect during sign-up when autoEnableOnSignUp is false", async () => {
			mockOnboardingRedirect.mockClear();
			const { resetDatabase, signUpWithTestUser } = await getTestInstance(
				getAuth({
					autoEnableOnSignUp: false,
				}),
				{
					clientOptions: {
						plugins: [
							onboardingClient({
								onOnboardingRedirect: mockOnboardingRedirect,
							}),
						],
					},
				},
			);
			await signUpWithTestUser();
			expect(mockOnboardingRedirect).not.toHaveBeenCalled();
		});
	});
});
