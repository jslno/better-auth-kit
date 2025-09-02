import type { GenericEndpointContext, User } from "better-auth";
import type { AppInvitation } from "./schema";
import type { FieldAttribute } from "better-auth/db";

export type AppInvitationType = "personal" | "public";

export type AppInviteOptions = {
	/**
	 * Define whether a user is allowed to send invitations.
	 *
	 * You can also pass a function that returns a boolean.
	 *
	 * 	@example
	 * ```ts
	 * allowUserToCreateInvitation: async (user) => {
	 * 		const canInvite: boolean = await hasPermission(user, 'send-invitation');
	 *      return canInvite;
	 * }
	 * ```
	 * @deprecated use `canCreateInvitation` instead.
	 */
	allowUserToCreateInvitation?:
		| boolean
		| ((
				user: User & Record<string, any>,
				type: AppInvitationType,
		  ) => Promise<boolean> | boolean);
	/**
	 * Define whether a user is allowed to cancel invitations.
	 *
	 * By default users can only cancel invitations issued by themself.
	 *
	 * @deprecated use `canCancelInvitation` instead.
	 */
	allowUserToCancelInvitation?: (data: {
		user: User;
		invitation: AppInvitation;
	}) => Promise<boolean> | boolean;
	/**
	 * Define whether a user is allowed to send invitations.
	 *
	 * You can also pass a function that returns a boolean.
	 *
	 * 	@example
	 * ```ts
	 * allowUserToCreateInvitation: async (user) => {
	 * 		const canInvite: boolean = await hasPermission(user, 'send-invitation');
	 *      return canInvite;
	 * }
	 * ```
	 * @default true
	 */
	canCreateInvitation?:
		| ((ctx: GenericEndpointContext) => Promise<boolean> | boolean)
		| boolean;
	/**
	 * Define whether a user is allowed to cancel invitations.
	 *
	 * By default users can only cancel invitations issued by themself.
	 */
	canCancelInvitation?:
		| ((
				ctx: GenericEndpointContext,
				invite: AppInvitation & Record<string, any>,
		  ) => Promise<boolean> | boolean)
		| boolean;
	/**
	 * Send an email with the invitation link to the user.
	 */
	sendInvitationEmail?: (
		invitation: AppInvitation & {
			type: AppInvitationType;
			inviter: User & Record<string, any>;
		},
		request: Request | undefined,
	) => Promise<void>;
	/**
	 * The expiration time for the invitation link.
	 *
	 * @default 48 hours
	 */
	invitationExpiresIn?: number | null;
	/**
	 * Automatically sign in the user after sign up.
	 */
	autoSignIn?: boolean;
	/**
	 * Clean up expires invitations when a value is fetched.
	 *
	 * @default true
	 */
	cleanupExpiredInvitations?: boolean;
	/**
	 * Delete personal invitations when a decision is made
	 * (accept/reject) on one of them.
	 *
	 * @default false
	 */
	cleanupPersonalInvitesOnDecision?: boolean;
	/**
	 * Store invitations in secondary storage in addition to the primary database.
	 *
	 * @default false
	 */
	secondaryStorage?: boolean;
	/**
	 * If true, mark the user's email as verified upon accepting an invitation
	 *
	 * @default true
	 */
	verifyEmailOnAccept?: boolean;
	/**
	 * Rate limit configuration.
	 *
	 * @default {
	 *  window: 60,
	 *  max: 5,
	 * }
	 */
	rateLimit?: {
		window: number;
		max: number;
	};
	/**
	 * The schema for the app-invite plugin.
	 */
	schema?: {
		appInvitation?: {
			modelName?: string;
			fields?: {
				[key in keyof Omit<AppInvitation, "id">]?: string;
			};
			/**
			 * Add extra invitation colums
			 */
			additionalFields?: {
				[key in string]: FieldAttribute;
			};
		};
		user?: {
			/**
			 * Add extra user columns used by this plugin.
			 *
			 * (Note: These fields won't be included in the database schema,
			 * assuming they're already defined in `BetterAuthOptions`)
			 */
			additionalFields?: {
				[key in string]: FieldAttribute;
			};
		};
	};
};
