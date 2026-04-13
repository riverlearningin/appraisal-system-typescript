export function isHttpStatus(error: unknown, status: number): boolean {
    const maybeResponse = (error as { response?: { status?: number } } | null)?.response;
    return maybeResponse?.status === status;
}

export function getHttpErrorMessage(error: unknown, fallback: string): string {
    const maybeResponseData = (error as {
        response?: {
            data?: {
                message?: string | string[];
            };
        };
    } | null)?.response?.data;

    const message = maybeResponseData?.message;

    if (Array.isArray(message) && message.length > 0) {
        return String(message[0]);
    }

    if (typeof message === 'string' && message.trim().length > 0) {
        return message;
    }

    return fallback;
}
