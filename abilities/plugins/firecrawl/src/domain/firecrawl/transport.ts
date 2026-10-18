/**
 * The transport contract this plugin needs from the host.
 *
 * Narrower than the host's own network API on purpose: the REST client and the
 * tests only depend on "send a request, get status + text back".
 */

export interface MultipartFile {
	fieldName: string;
	fileName: string;
	mimeType: string;
	/** Base64 payload; the host re-encodes it into the multipart body. */
	data: string;
}

export type TransportBody =
	| { type: "json"; value: unknown }
	| { type: "multipart"; fields?: Record<string, string>; files?: MultipartFile[] };

export interface TransportRequest {
	url: string;
	method: "GET" | "POST" | "PATCH" | "DELETE";
	headers?: Record<string, string>;
	body?: TransportBody;
	timeoutMs?: number;
}

export interface TransportResponse {
	status: number;
	ok: boolean;
	/** Raw response text; the caller decides how to parse it. */
	body: string;
	durationMs?: number;
}

export type Transport = (request: TransportRequest) => Promise<TransportResponse>;

export type TransportFailure = "timed-out" | "host-not-allowed" | "response-too-large" | "transport-failed";

export class TransportError extends Error {
	constructor(
		message: string,
		readonly reason: TransportFailure,
	) {
		super(message);
		this.name = "TransportError";
	}
}
