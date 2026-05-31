import { describe, expect, it } from "vitest";
import { sanitizeBrowserSnapshotText } from "./snapshotSanitizer";

describe("browser snapshot sanitizer", () => {
  it("redacts secrets and contact-like values before AI context injection", () => {
    const result = sanitizeBrowserSnapshotText(
      "password=abc123 token: secret-value user@example.com +1 415 555 1234",
    );

    expect(result.text).not.toContain("abc123");
    expect(result.text).not.toContain("secret-value");
    expect(result.text).toContain("[redacted-email]");
    expect(result.privacy.redactionApplied).toBe(true);
    expect(result.privacy.redactedKinds).toEqual(
      expect.arrayContaining(["password", "token", "email", "phone"]),
    );
  });
});
