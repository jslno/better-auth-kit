import type { StorageProvider } from "../types";

export const createStorageProvider = <O, P extends StorageProvider<O>>(
	provider: P & {
		$Infer?: {
			Options?: O;
		};
	},
) => provider;
