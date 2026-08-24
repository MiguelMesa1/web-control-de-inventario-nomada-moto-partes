import { createInsForgeAdminClient } from "@/lib/insforge/server";

type AuditEvent = {
  actorId: string;
  action: string;
  entityType: string;
  entityId?: string | null;
  details?: Record<string, unknown>;
};

export async function recordAuditEvent(event: AuditEvent) {
  const admin = createInsForgeAdminClient();
  const { error } = await admin.database.from("audit_events").insert([
    {
      actor_id: event.actorId,
      action: event.action,
      entity_type: event.entityType,
      entity_id: event.entityId ?? null,
      details: event.details ?? {},
    },
  ]);
  if (error) {
    console.error("audit_event_write_failed", {
      action: event.action,
      entityType: event.entityType,
      error: error.message,
    });
  }
}
