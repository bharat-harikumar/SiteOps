// Wrap the complete API handler so rate limits and caught errors are private too.
export function withPrivateNoStore<TArgs extends unknown[]>(
  handler: (...args: TArgs) => Promise<Response>,
): (...args: TArgs) => Promise<Response> {
  return async (...args: TArgs) => {
    const response = await handler(...args);
    response.headers.set("cache-control", "private, no-store");
    return response;
  };
}
