import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { getAppProfile, createInsForgeAdminClient, signUp, insert, recordAuditEvent } = vi.hoisted(() => ({
  getAppProfile: vi.fn(), createInsForgeAdminClient: vi.fn(), signUp: vi.fn(), insert: vi.fn(), recordAuditEvent: vi.fn(),
}));
vi.mock("@/lib/insforge/session", () => ({ getAppProfile }));
vi.mock("@/lib/insforge/server", () => ({ createInsForgeAdminClient, createInsForgeServerClient: vi.fn() }));
vi.mock("@/lib/security/audit", () => ({ recordAuditEvent }));
import { POST } from "./route";

const id = "b3b7dbed-bae3-4b74-a7ef-84ee292724ad";
const body = { displayName: "Ensayo", email: "trial@example.invalid", password: "Synthetic-Account-742!", role: "reader" };
const request = () => new Request("https://inventory.example/api/admin/users", {
  method: "POST", headers: { origin: "https://inventory.example", "content-type": "application/json" }, body: JSON.stringify(body),
});
describe("administrative user provisioning", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("INSFORGE_URL", "https://backend.example");
    vi.stubEnv("INSFORGE_ANON_KEY", "test-anon");
    vi.stubEnv("INSFORGE_API_KEY", "test-admin-key");
    getAppProfile.mockResolvedValue({ id: "actor", role: "admin" });
    signUp.mockResolvedValue({ data: { accessToken: null, requireEmailVerification: false }, error: null });
    insert.mockReturnValue({ select: () => ({ single: async () => ({ data: { id, email: body.email, display_name: body.displayName, role: "reader", active: true, is_primary: false }, error: null }) }) });
    createInsForgeAdminClient.mockReturnValue({ auth: { signUp }, database: { from: () => ({ insert }) } });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json({ data: [{ id, email: body.email }] })));
  });
  afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

  it("resolves an admin-created account when signup deliberately omits user and tokens", async () => {
    const response = await POST(request());
    expect(response.status).toBe(200);
    expect(insert).toHaveBeenCalledWith([expect.objectContaining({ id, email: body.email, role: "reader", is_primary: false })]);
    expect(fetch).toHaveBeenCalledWith(expect.any(URL), expect.objectContaining({ cache: "no-store", headers: { Authorization: "Bearer test-admin-key" } }));
    expect(await response.json()).toEqual({ user: expect.objectContaining({ id, role: "reader" }) });
  });

  it.each([
    { data: [{ id, email: "different@example.invalid" }] },
    { data: [{ id: "not-a-uuid", email: body.email }] },
    { data: [] },
  ])("does not assign a role to an unresolved or mismatched identity: %j", async (payload) => {
    vi.mocked(fetch).mockResolvedValue(Response.json(payload));
    expect((await POST(request())).status).toBe(400);
    expect(insert).not.toHaveBeenCalled();
  });

  it("does not use the lookup to bypass a signup rejection", async () => {
    signUp.mockResolvedValue({ data: null, error: { message: "rejected" } });
    expect((await POST(request())).status).toBe(400);
    expect(fetch).not.toHaveBeenCalled();
    expect(insert).not.toHaveBeenCalled();
  });

  it("keeps the normal SDK response path without listing accounts", async () => {
    signUp.mockResolvedValue({ data: { user: { id } }, error: null });
    expect((await POST(request())).status).toBe(200);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("rejects non-admin callers before provisioning accounts", async () => {
    getAppProfile.mockResolvedValue({ role: "uploader" });
    expect((await POST(request())).status).toBe(403);
    expect(signUp).not.toHaveBeenCalled();
  });
});
