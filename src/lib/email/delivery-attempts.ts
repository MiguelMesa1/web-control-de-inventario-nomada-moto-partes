import { createAuthenticatedInsForgeServerClient } from "@/lib/insforge/authenticated-server";
import { isInsForgeConfigured } from "@/lib/insforge/config";
import { createInsForgeAdminClient } from "@/lib/insforge/server";
import type { EmailDeliveryAttempt } from "@/types/inventory";

type RecordEmailDeliveryAttempt = Omit<
  EmailDeliveryAttempt,
  "id" | "createdAt"
> & {
  attemptedBy: string;
};

export async function recordEmailDeliveryAttempt(
  attempt: RecordEmailDeliveryAttempt,
) {
  const admin = createInsForgeAdminClient();
  const { error } = await admin.database.from("email_delivery_attempts").insert([
    {
      snapshot_id: attempt.snapshotId,
      attempted_by: attempt.attemptedBy,
      filename: attempt.filename,
      sender_email: attempt.senderEmail,
      recipient_email: attempt.recipientEmail,
      recipient_name: attempt.recipientName,
      subject: attempt.subject,
      status: attempt.status,
      alert_count: attempt.alertCount,
      suggested_units: attempt.suggestedUnits,
      duration_ms: attempt.durationMs,
      provider_message_id: attempt.providerMessageId,
      provider_response: attempt.providerResponse,
      error_code: attempt.errorCode,
      error_message: attempt.errorMessage,
    },
  ]);
  if (error) throw new Error(error.message);
}

export async function loadEmailDeliveryAttempts(
  limit = 50,
): Promise<EmailDeliveryAttempt[]> {
  if (!isInsForgeConfigured()) return [];

  const insforge = await createAuthenticatedInsForgeServerClient();
  const { data, error } = await insforge.database
    .from("email_delivery_attempts")
    .select(
      "id,snapshot_id,filename,sender_email,recipient_email,recipient_name,subject,status,alert_count,suggested_units,duration_ms,provider_message_id,provider_response,error_code,error_message,created_at",
    )
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw new Error(error.message);

  return (data ?? []).map((row) => ({
    id: String(row.id),
    snapshotId: row.snapshot_id == null ? undefined : String(row.snapshot_id),
    filename: String(row.filename),
    senderEmail: String(row.sender_email),
    recipientEmail: String(row.recipient_email),
    recipientName:
      row.recipient_name == null ? undefined : String(row.recipient_name),
    subject: String(row.subject),
    status: row.status === "sent" ? "sent" : "failed",
    alertCount: Number(row.alert_count),
    suggestedUnits: Number(row.suggested_units),
    durationMs: row.duration_ms == null ? undefined : Number(row.duration_ms),
    providerMessageId:
      row.provider_message_id == null
        ? undefined
        : String(row.provider_message_id),
    providerResponse:
      row.provider_response == null ? undefined : String(row.provider_response),
    errorCode: row.error_code == null ? undefined : String(row.error_code),
    errorMessage:
      row.error_message == null ? undefined : String(row.error_message),
    createdAt: String(row.created_at),
  }));
}
