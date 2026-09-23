/** La liste d'inclusion des journaux : ce qui n'est pas nommé ne passe pas. */

import { describe, expect, test } from "vitest";
import { redactRoute, sanitizeLogFields } from "../../convex/lib/log";

describe("journaux structurés", () => {
  test("un champ non autorisé — jeton, code, e-mail — est jeté", () => {
    const out = sanitizeLogFields({
      traceId: "t-1",
      organizationId: "org",
      token: "secret-jeton",
      otp: "123456",
      email: "awa@maquis.ci",
      password: "x",
    });
    expect(out).toEqual({ traceId: "t-1", organizationId: "org" });
    expect(JSON.stringify(out)).not.toMatch(/secret|123456|awa@/);
  });

  test("les objets ne passent pas, même dans un champ autorisé", () => {
    expect(sanitizeLogFields({ message: { token: "x" } as unknown as string })).toEqual({});
  });

  test("le jeton d'invitation est retiré de la route", () => {
    expect(redactRoute("/invitation/AbC-123_xyz?x=1")).toBe("/invitation/:jeton");
    expect(redactRoute("/r/maquis-awa/t/Zx9_-kQ2mPvLw8RtYu3aBc")).toBe("/r/maquis-awa/t/:jeton");
    expect(sanitizeLogFields({ route: "/invitation/AbC-123_xyz" }).route).toBe("/invitation/:jeton");
  });
});
