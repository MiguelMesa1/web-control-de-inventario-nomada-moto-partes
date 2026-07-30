import { NextResponse } from "next/server";
import { createInsForgeServerClient } from "@/lib/insforge/server";
import { getAppProfile } from "@/lib/insforge/session";
import { requireSameOrigin } from "@/lib/security/request";

type AttachmentRow = {
  id: string;
  sku: string;
  file_name: string;
  file_key: string;
  mime_type: string;
};

async function getAttachment(id: string) {
  const insforge = await createInsForgeServerClient();
  const { data, error } = await insforge.database
    .from("product_attachments")
    .select("id,sku,file_name,file_key,mime_type")
    .eq("id", id)
    .single();
  if (error || !data) return { insforge, attachment: null };
  return { insforge, attachment: data as AttachmentRow };
}

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const profile = await getAppProfile();
  if (profile.role !== "admin" && profile.role !== "uploader") {
    return NextResponse.json(
      { message: "No tienes acceso a documentos internos." },
      { status: 403 },
    );
  }
  const { id } = await context.params;
  const { insforge, attachment } = await getAttachment(id);
  if (!attachment) {
    return NextResponse.json({ message: "Documento no encontrado." }, { status: 404 });
  }
  const { data, error } = await insforge.storage
    .from("product-documents")
    .download(attachment.file_key);
  if (error || !data) {
    return NextResponse.json(
      { message: error?.message ?? "No pudimos descargar el documento." },
      { status: 404 },
    );
  }
  return new NextResponse(data, {
    headers: {
      "content-type": attachment.mime_type,
      "content-disposition": `inline; filename*=UTF-8''${encodeURIComponent(attachment.file_name)}`,
      "cache-control": "private, no-store",
    },
  });
}

export async function DELETE(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const requestError = requireSameOrigin(request);
  if (requestError) return requestError;
  const profile = await getAppProfile();
  if (profile.role !== "admin" && profile.role !== "uploader") {
    return NextResponse.json(
      { message: "No tienes permiso para eliminar documentos." },
      { status: 403 },
    );
  }
  const { id } = await context.params;
  const { insforge, attachment } = await getAttachment(id);
  if (!attachment) {
    return NextResponse.json({ message: "Documento no encontrado." }, { status: 404 });
  }

  const { error: storageError } = await insforge.storage
    .from("product-documents")
    .remove(attachment.file_key);
  if (storageError) {
    return NextResponse.json({ message: storageError.message }, { status: 400 });
  }
  const { error } = await insforge.database
    .from("product_attachments")
    .delete()
    .eq("id", id);
  if (error) {
    return NextResponse.json({ message: error.message }, { status: 400 });
  }
  await insforge.database.from("audit_events").insert([
    {
      actor_id: profile.id,
      action: "attachment.deleted",
      entity_type: "product_attachment",
      entity_id: id,
      details: {
        sku: attachment.sku,
        file_name: attachment.file_name,
        file_key: attachment.file_key,
      },
    },
  ]);
  return NextResponse.json({ ok: true });
}
