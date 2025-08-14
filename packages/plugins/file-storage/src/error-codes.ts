export const ERROR_CODES = {
	MISSING_BODY: "Missing body",
	MISSING_CONTENT_TYPE_HEADER: "Missing Content-Type header",
	MISSING_BOUNDARY_IN_CONTENT_TYPE_HEADER:
		"Missing boundary in Content-Type header",
	UNABLE_TO_RETRIEVE_FILENAME: "Unable to retrieve filename",
	MAX_FILE_SIZE_EXCEEDED: "Max file size exceeded",
	MAX_HEADER_SIZE_EXCEEDED: "Max header size exceeded",
	MAX_FILES_EXCEEDED: "Max files exceeded",
	INVALID_FILE_TYPE: "Invalid file type",
} as const;
