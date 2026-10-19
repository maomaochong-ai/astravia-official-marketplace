import { describe, expect, it } from "vitest";
import { failureMessageKey } from "../domain/failure-codes";

describe("failureMessageKey", () => {
  it("maps engine failure codes to localized message keys", () => {
    expect(failureMessageKey("network_timeout")).toBe("error.networkTimeout");
    expect(failureMessageKey("network_blocked")).toBe("error.networkBlocked");
    expect(failureMessageKey("auth_required")).toBe("error.authRequired");
    expect(failureMessageKey("site_unsupported")).toBe("error.siteUnsupported");
  });

  it("leaves unknown or missing codes to the raw message", () => {
    expect(failureMessageKey("something_new")).toBeNull();
    expect(failureMessageKey(null)).toBeNull();
  });
});
