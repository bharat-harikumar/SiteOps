// Tests must never infer permission to write from the production .env.local.
// The dedicated database name also excludes an ordinary local client database.
export function isDisposableTestDatabase(value: string | undefined): boolean {
  if (!value) return false;
  try {
    // postgres-js supports multihost authorities and splits credentials at the
    // first @, whereas URL uses the last @. Accept only an unambiguous URI.
    const authority = /^postgres(?:ql)?:\/\/([^/?#]*)/i.exec(value)?.[1];
    if (
      !authority ||
      (authority.match(/@/g)?.length ?? 0) > 1 ||
      /,|%2c/i.test(authority)
    )
      return false;
    const url = new URL(value);
    return (
      ["postgres:", "postgresql:"].includes(url.protocol) &&
      ["127.0.0.1", "localhost", "[::1]"].includes(url.hostname) &&
      url.pathname === "/siteops_tools_test" &&
      ![...url.searchParams.keys()].some((key) =>
        /^(host|hostaddr|port|database|dbname)$/i.test(key),
      )
    );
  } catch {
    return false;
  }
}
