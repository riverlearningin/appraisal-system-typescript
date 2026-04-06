export function isHttpStatus(error: unknown, status: number): boolean {
    const maybeResponse = (error as { response?: { status?: number } } | null)?.response;
    return maybeResponse?.status === status;
}
