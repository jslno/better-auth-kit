import { betterAuth } from "better-auth";
import { fileStorage } from "../src";
import { awsS3Provider } from "../src/providers/aws-s3";
import { uploadThingProvider } from "../src/providers/uploadthing";

export const auth = betterAuth({
	plugins: [
		fileStorage({
			provider: awsS3Provider({
				client: {} as any,
				bucket: "default-bucket",
			}),
			router: {
				"profile-image": {
					maxFiles: 1,
					bucket: "pfp-bucket",
					ACL: "public-read",
				},
				"profile-banner": {
					maxFiles: 1,
					ACL: "public-read",
				},
			},
		}),
		fileStorage({
			provider: uploadThingProvider({
				utapi: {} as any,
			}),
			router: {
				"profile-image": {
					maxFiles: 1,
					acl: "public-read",
				},
				"profile-banner": {
					maxFiles: 1,
					metadata: {
						key: "value",
					},
				},
			},
		}),
	],
});

export type FileStoragePaths = typeof auth.$Infer.FileStoragePaths;
