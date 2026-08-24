import { createInsForgeAdminClient } from "@/lib/insforge/server";

type SecurityEvent = {
  eventType: string;
  outcome: "success" | "failure" | "blocked" | "error";
  actorId?: string | null;
  subjectHash?: string | null;
  ipHash?: string | null;
  requestPath?: string | null;
  requestMethod?: string | null;
  statusCode?: number | null;
  details?: Record<string, string | number | boolean | null>;
};

export async function recordSecurityEvent(event: SecurityEvent) {
  try {
    const admin = createInsForgeAdminClient();
    const { error } = await admin.database.from("security_events").insert([
      {
        event_type: event.eventType.slice(0, 80),
        outcome: event.outcome,
        actor_id: event.actorId ?? null,
        subject_hash: event.subjectHash ?? null,
        ip_hash: event.ipHash ?? null,
        request_path: event.requestPath?.slice(0, 300) ?? null,
        request_method: event.requestMethod?.slice(0, 12) ?? null,
        status_code: event.statusCode ?? null,
        details: event.details ?? {},
      },
    ]);
    if (error) throw error;
  } catch (error) {
    console.error("security_event_write_failed", {
      eventType: event.eventType,
      outcome: event.outcome,
      error: error instanceof Error ? error.name : "unknown",
    });
  }
}
