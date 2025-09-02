import type { BetterAuthPlugin } from "better-auth";
import type { AppInviteOptions } from "./types";
import { APP_INVITE_ERROR_CODES } from "./error-codes";
import { schema, type AppInvitation, type AppInvitationStatus } from "./schema";
import {
	createAppInvitation,
	getAppInvitation,
	acceptAppInvitation,
	rejectAppInvitation,
	cancelAppInvitation,
	listAppInvitations,
} from "./routes";
import { getAdditionalFields } from "./utils";

export const appInvite = <O extends AppInviteOptions, S extends boolean = true>(
	opts?: O,
) => {
	const options = {
		canCreateInvitation: true,
		canCancelInvitation(ctx, invite) {
			return invite.inviterId === ctx.context.session?.user.id;
		},
		cleanupExpiredInvitations: true,
		cleanupPersonalInvitesOnDecision: false,
		verifyEmailOnAccept: true,
		rateLimit: {
			window: 60,
			max: 5,
		},
		...opts,
	} satisfies AppInviteOptions;

	const additionalFields = getAdditionalFields(options as O, false);

	const endpoints = {
		createAppInvitation: createAppInvitation<O, typeof additionalFields, S>(
			options as O,
			additionalFields,
		),
		getAppInvitation: getAppInvitation(options as O, additionalFields),
		acceptAppInvitation: acceptAppInvitation(options as O, additionalFields),
		rejectAppInvitation: rejectAppInvitation(options as O, additionalFields),
		cancelAppInvitation: cancelAppInvitation(options as O, additionalFields),
		listAppInvitations: listAppInvitations(options as O, additionalFields),
	};
	const endpointPaths = Object.values(endpoints).map((e) => e.path);

	return {
		id: "app-invite",
		endpoints,
		rateLimit: [
			{
				pathMatcher(path) {
					return endpointPaths.some((e) => path.startsWith(e));
				},
				...options.rateLimit,
			},
		],
		schema: !options.secondaryStorage
			? {
					...schema,
					appInvitation: {
						...schema.appInvitation,
						fields: {
							...schema.appInvitation.fields,
							...options.schema?.appInvitation?.additionalFields,
						},
					},
				}
			: undefined,
		$Infer: {
			AppInvitation: {} as AppInvitation &
				typeof additionalFields.$ReturnAdditionalFields,
		},
		$ERROR_CODES: APP_INVITE_ERROR_CODES,
	} satisfies BetterAuthPlugin;
};
