import { beforeEach, describe, expect, it, vi } from "vitest";

const { createInsForgeServerClient, getAppProfile } = vi.hoisted(() => ({
  createInsForgeServerClient: vi.fn(),
  getAppProfile: vi.fn(),
}));

vi.mock("@/lib/insforge/server", () => ({ createInsForgeServerClient }));
vi.mock("@/lib/insforge/session", () => ({ getAppProfile }));

import { createAuthenticatedInsForgeServerClient } from "@/lib/insforge/authenticated-server";

describe("createAuthenticatedInsForgeServerClient", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("validates the app session before creating a database client", async () => {
    const client = { database: {} };
    getAppProfile.mockResolvedValue({ id: "user-1" });
    createInsForgeServerClient.mockResolvedValue(client);

    await expect(createAuthenticatedInsForgeServerClient()).resolves.toBe(
      client,
    );

    expect(getAppProfile).toHaveBeenCalledOnce();
    expect(createInsForgeServerClient).toHaveBeenCalledOnce();
    expect(getAppProfile.mock.invocationCallOrder[0]).toBeLessThan(
      createInsForgeServerClient.mock.invocationCallOrder[0],
    );
  });

  it("does not create a database client when session validation fails", async () => {
    getAppProfile.mockRejectedValue(new Error("redirect"));

    await expect(createAuthenticatedInsForgeServerClient()).rejects.toThrow(
      "redirect",
    );
    expect(createInsForgeServerClient).not.toHaveBeenCalled();
  });
});
