import { APIError, getSessionFromCtx } from "better-auth/api";
import type { GenericEndpointContext } from "better-auth/types";
import { ONBOARDING_ERROR_CODES } from "./error-codes";

export async function verifyOnboarding(ctx: GenericEndpointContext) {
	const session = await getSessionFromCtx(ctx);

	if (!session) {
		throw new APIError("UNAUTHORIZED");
	}

	if (!session.user.shouldOnboard) {
		throw new APIError("FORBIDDEN", {
			message: ONBOARDING_ERROR_CODES.ALREADY_ONBOARDED,
		});
	}

	return {
		session,
		key: `${session.user.id}!${session.session.id}`,
	};
}
