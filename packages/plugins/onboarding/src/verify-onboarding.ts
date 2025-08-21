import { APIError, getSessionFromCtx } from "better-auth/api";
import type { GenericEndpointContext } from "better-auth/types";
import { ONBOARDING_ERROR_CODES } from "./error-codes";

export async function verifyOnboarding(ctx: GenericEndpointContext) {
	const session = await getSessionFromCtx(ctx);

	if (!session) {
		throw new APIError("UNAUTHORIZED");
	}

	if (!session.user.shouldOnboard) {
		throw new APIError("UNAUTHORIZED", {
			message: ONBOARDING_ERROR_CODES.ALREADY_ONBOARDED,
		});
	}

	return {
		session,
		key: `${session.user.id}!${session.session.id}`,
		valid: async (ctx: GenericEndpointContext) => {
			return ctx.json({
				user: {
					id: session.user.id,
					email: session.user.email,
					emailVerified: session.user.emailVerified,
					firstName: session.user.firstName,
					name: session.user.name,
					image: session.user.image,
					createdAt: session.user.createdAt,
					updatedAt: session.user.updatedAt,
				},
			});
		},
	};
}
