// Stock and permission-sensitive tool screens must never fall back to an old
// persistent response, including Next's RSC requests to these page paths.
export function isLiveToolPath(pathname: string): boolean {
  return /^\/(?:api|app)\/(?:tools(?:\/|$)|sites\/[^/]+\/tools(?:\/|$))/.test(
    pathname,
  );
}
