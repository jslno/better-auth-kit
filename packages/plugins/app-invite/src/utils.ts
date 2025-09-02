import {
	type InferAdditionalFieldsFromPluginOptions,
	toZodSchema,
} from "better-auth/db";
import type { AppInviteOptions } from "./types";
import type { AuthContext, BetterAuthPlugin } from "better-auth";

export const getDate = (span: number, unit: "sec" | "ms" = "ms") => {
	return new Date(Date.now() + (unit === "sec" ? span * 1000 : span));
};

export const getPlugin = <P extends BetterAuthPlugin = BetterAuthPlugin>(
	id: string,
	context: AuthContext,
) => {
	return context.options.plugins?.find((p) => p.id === id) as P | undefined;
};

export type IsExactlyEmptyObject<T> = keyof T extends never // no keys
	? T extends {} // is assignable to {}
		? {} extends T
			? true
			: false // and {} is assignable to it
		: false
	: false;

export const getAdditionalFields = <
	O extends AppInviteOptions,
	AllPartial extends boolean = false,
>(
	options: O,
	shouldBePartial: AllPartial = false as AllPartial,
) => {
	const additionalFields =
		options.schema?.appInvitation?.additionalFields || {};
	if (shouldBePartial) {
		for (const key in additionalFields) {
			additionalFields[key]!.required = false;
		}
	}
	const additionalFieldsSchema = toZodSchema({
		fields: additionalFields,
		isClientSide: true,
	});
	type AdditionalFields = AllPartial extends true
		? Partial<InferAdditionalFieldsFromPluginOptions<"appInvitation", O>>
		: InferAdditionalFieldsFromPluginOptions<"appInvitation", O>;
	type ReturnAdditionalFields = InferAdditionalFieldsFromPluginOptions<
		"appInvitation",
		O,
		false
	>;

	return {
		additionalFieldsSchema,
		$AdditionalFields: {} as AllPartial extends true
			? Partial<AdditionalFields>
			: AdditionalFields,
		$ReturnAdditionalFields: {} as ReturnAdditionalFields,
	};
};

type CommonKeys<T extends object> = keyof T;
type AllKeys<T> = T extends any ? keyof T : never;
type Subtract<A, C> = A extends C ? never : A;
type NonCommonKeys<T extends object> = Subtract<AllKeys<T>, CommonKeys<T>>;

type PickType<T, K extends AllKeys<T>> = T extends { [k in K]?: any }
	? T[K]
	: undefined;

export type Merge<T extends object> = {
	[k in CommonKeys<T>]: PickTypeOf<T, k>;
} & {
	[k in NonCommonKeys<T>]?: PickTypeOf<T, k>;
};

type PickTypeOf<T, K extends string | number | symbol> = K extends AllKeys<T>
	? PickType<T, K>
	: never;
