import type { MultipartPart } from "@remix-run/multipart-parser";
import type { GenericEndpointContext, Session, User } from "better-auth";
import type { UploadReturnType } from "./internal-types";

export type StorageProvider<O = {}> = {
	upload: (params: {
		part: MultipartPart;
		key: string;
		route: FileRoute & O;
		context: GenericEndpointContext;
	}) => Promise<{
		key?: string;
		providerURL?: string;
		eTag?: string;
	}>;

	delete: (params: {
		fileURL: string;
	}) => Promise<void>;

	$Infer?: {
		Options?: O;
	};
};

export type FileStorageOptions<
	P extends StorageProvider<any>,
	R extends FileRouter<P>,
> = {
	/**
	 * Storage provider used for file actions
	 */
	provider: P;

	/**
	 * An object of routes which define the rules of file uploads.
	 */
	router: R;
};

export type FileRouter<P extends StorageProvider<any> = StorageProvider> = {
	[key: string]: FileRoute<P>;
};

export type FileRoute<P extends StorageProvider<any> = StorageProvider> = {
	/**
	 * Maximum amount of files to upload
	 * @default Number.POSITIVE_INFINITY
	 */
	maxFiles?:
		| number
		| ((session: {
				user: User & Record<string, any>;
				session: Session & Record<string, any>;
		  }) => number | Promise<number>);
	/**
	 * Maximum file size in bytes
	 * @default 5_242_880 (5MB)
	 */
	maxSize?:
		| number
		| ((session: {
				user: User & Record<string, any>;
				session: Session & Record<string, any>;
		  }) => number | Promise<number>);

	/**
	 * Maximum header size in bytes
	 * @default 2_048 (2KiB)
	 */
	maxHeaderSize?:
		| number
		| ((session: {
				user: User & Record<string, any>;
				session: Session & Record<string, any>;
		  }) => number | Promise<number>);

	/**
	 * Allowed file MIME types
	 * By default, all MIME types are allowed. However, we recommend specifying the allowed types to avoid unexpected or unwanted file types.
	 */
	allowedTypes?:
		| string[]
		| ((session: {
				user: User & Record<string, any>;
				session: Session & Record<string, any>;
		  }) => string[] | Promise<string[]>);

	/**
	 * Callback function that gets executed server-side when an file is uploaded
	 * @param params Object containing the file entry and user
	 */
	onFileUploaded?: (params: {
		file: Awaited<ReturnType<StorageProvider["upload"]>> & {
			fileStorageURL: string;
		};
		ctx: GenericEndpointContext;
	}) => void | Promise<void>;

	/**
	 * Hooks for intercepting file operations at different stages
	 * 
	 * @example
	 * ```typescript
	 * hooks: {
	 *   upload: {
	 *     before: async (ctx) => {
	 *       // Check if user has permission to upload
	 *       if (!ctx.context.session?.user.canUpload) {
	 *         throw ctx.error("FORBIDDEN", { message: "Upload not allowed" });
	 *       }
	 *       
	 *       // Dynamically modify route configuration
	 *       return {
	 *         maxSize: ctx.context.session.user.isPremium ? 50_000_000 : 5_000_000
	 *       };
	 *     },
	 *     after: async (ctx) => {
	 *       // Log successful upload with file details
	 *       console.log(`Files uploaded by ${ctx.context.session?.user.id}:`, ctx.uploadedFiles);
	 *     }
	 *   }
	 * }
	 * ```
	 */
	hooks?: {
		upload?: {
			/**
			 * Hook executed before file upload processing begins
			 * 
			 * This hook is particularly useful for:
			 * - **Authorization**: Check if the user has permission to upload files
			 * - **Dynamic configuration**: Modify route settings based on user context
			 * - **Pre-validation**: Perform custom validation before file processing
			 * - **Business logic**: Implement custom upload rules and restrictions
			 * 
			 * @param ctx - The endpoint context containing session, request, and error handling utilities
			 * @returns Optional partial route configuration to override or extend the current route settings
			 * 
			 * @example
			 * ```typescript
			 * before: async (ctx) => {
			 *   // Authorization check
			 *   const user = ctx.context.session?.user;
			 *   if (!user?.subscription?.canUpload) {
			 *     throw ctx.error("FORBIDDEN", { 
			 *       message: "Upgrade your subscription to upload files" 
			 *     });
			 *   }
			 *   
			 *   // Dynamic file size limit based on subscription tier
			 *   const maxSize = user.subscription.tier === 'premium' ? 100_000_000 : 10_000_000;
			 *   
			 *   return { maxSize };
			 * }
			 * ```
			 */
			before?: (
				ctx: GenericEndpointContext,
			) =>
				| (Partial<FileRoute<P>> | void)
				| Promise<Partial<FileRoute<P>> | void>;
			
			/**
			 * Hook executed after successful file upload
			 * 
			 * Use this hook for:
			 * - **Logging**: Record successful uploads for analytics
			 * - **Notifications**: Send notifications about uploaded files
			 * - **Database updates**: Update related records or metadata
			 * - **Post-processing**: Trigger additional workflows
			 * 
			 * @param ctx - Object containing the endpoint context and uploaded files information
			 * @param ctx.context - The endpoint context containing session and request information
			 * @param ctx.uploadedFiles - Array of successfully uploaded files with their URLs and metadata
			 * 
			 * @example
			 * ```typescript
			 * after: async (ctx) => {
			 *   // Log upload activity with file details
			 *   await logActivity({
			 *     userId: ctx.context.session?.user.id,
			 *     action: 'file_upload',
			 *     files: ctx.uploadedFiles.map(f => f.fileStorageURL),
			 *     timestamp: new Date()
			 *   });
			 *   
			 *   // Send notification to team members with file count
			 *   await notifyTeam(
			 *     ctx.context.session?.user.teamId, 
			 *     `${ctx.uploadedFiles.length} files uploaded`
			 *   );
			 * }
			 * ```
			 */
			after?: (ctx: {
				context: GenericEndpointContext;
				uploadedFiles: UploadReturnType;
			}) => void | Promise<void>;
		};
		
		delete?: {
			/**
			 * Hook executed before file deletion
			 * 
			 * This hook is useful for:
			 * - **Authorization**: Verify user has permission to delete the specific file
			 * - **Validation**: Check if file can be safely deleted (e.g., not referenced elsewhere)
			 * - **Audit logging**: Record deletion attempts
			 * - **Pre-deletion checks**: Ensure file exists and is accessible
			 * 
			 * @param ctx - The endpoint context containing session, request, and error handling utilities
			 * 
			 * @example
			 * ```typescript
			 * before: async (ctx) => {
			 *   const fileId = ctx.request.body?.fileId;
			 *   const user = ctx.context.session?.user;
			 *   
			 *   // Check if user owns the file or has admin rights
			 *   const file = await getFile(fileId);
			 *   if (file.ownerId !== user.id && !user.isAdmin) {
			 *     throw ctx.error("FORBIDDEN", { 
			 *       message: "You can only delete your own files" 
			 *     });
			 *   }
			 *   
			 *   // Check if file is referenced in other records
			 *   const references = await checkFileReferences(fileId);
			 *   if (references.length > 0) {
			 *     throw ctx.error("BAD_REQUEST", { 
			 *       message: "Cannot delete file that is referenced elsewhere" 
			 *     });
			 *   }
			 * }
			 * ```
			 */
			before?: (ctx: GenericEndpointContext) => void | Promise<void>;
			
			/**
			 * Hook executed after successful file deletion
			 * 
			 * Use this hook for:
			 * - **Cleanup**: Remove related database records or metadata
			 * - **Audit logging**: Record successful deletions
			 * - **Notifications**: Notify relevant parties about file deletion
			 * - **Cache invalidation**: Clear related caches
			 * 
			 * @param ctx - The endpoint context containing session and request information
			 * 
			 * @example
			 * ```typescript
			 * after: async (ctx) => {
			 *   const fileId = ctx.request.body?.fileId;
			 *   
			 *   // Clean up database records
			 *   await deleteFileMetadata(fileId);
			 *   
			 *   // Log deletion for audit trail
			 *   await logDeletion({
			 *     fileId,
			 *     deletedBy: ctx.context.session?.user.id,
			 *     timestamp: new Date()
			 *   });
			 * }
			 * ```
			 */
			after?: (ctx: GenericEndpointContext) => void | Promise<void>;
		};
	};
} & (P extends { $Infer?: { Options?: infer O } } ? O : {});
