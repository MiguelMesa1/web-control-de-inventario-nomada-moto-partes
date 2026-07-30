import { NextResponse } from "next/server";
import { createInsForgeServerClient } from "@/lib/insforge/server";
import { getAppProfile } from "@/lib/insforge/session";

const allowedMimeTypes = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
]);

export async function GET(request: Request) {
  const profile = await getAppProfile();
  if (profile.role !== "admin" && profile.role !== "uploader") {
    return NextResponse.json(
      { message: "No tienes acceso a documentos internos." },
      { status: 403 },
    );
  }
  const sku = new URL(request.url).searchParams.get("sku")?.trim();
  if (!sku) {
    return NextResponse.json({ message: "Falta el SKU." }, { status: 400 });
  }
  const insforge = await createInsForgeServerClient();
  const { data, error } = await insforge.database
    .from("product_attachments")
    .select(
      "id,sku,file_name,file_url,file_key,mime_type,size_bytes,uploaded_by,created_at",
    )
    .eq("sku", sku)
    .order("created_at", { ascending: false });
  if (error) {
    return NextResponse.json({ message: error.message }, { status: 400 });
  }
  return NextResponse.json({ data: data ?? [] });
}

export async function POST(request: Request) {
  const profile = await getAppProfile();
  if (profile.role !== "admin" && profile.role !== "uploader") {
    return NextResponse.json({ message: "No tienes acceso a documentos internos." }, { status: 403 });
  }
  const formData = await request.formData();
  const sku = String(formData.get("sku") ?? "").trim();
  const file = formData.get("file");
  if (!sku || !(file instanceof File)) {
    return NextResponse.json({ message: "Faltan el SKU o el archivo." }, { status: 400 });
  }
  if (!allowedMimeTypes.has(file.type)) {
    return NextResponse.json({ message: "Usa PDF, JPG, PNG o WebP." }, { status: 415 });
  }
  if (file.size > 15 * 1024 * 1024) {
    return NextResponse.json({ message: "El archivo supera 15 MB." }, { status: 413 });
  }

  const safeName = file.name.replace(/[^a-zA-Z0-9._-]+/g, "-");
  const key = `${sku.replace(/[^a-zA-Z0-9_-]+/g, "-")}/${crypto.randomUUID()}-${safeName}`;
  const insforge = await createInsForgeServerClient();
  const { data: uploaded, error: uploadError } = await insforge.storage
    .from("product-documents")
    .upload(key, file);
  if (uploadError || !uploaded) {
    return NextResponse.json(
      { message: uploadError?.message ?? "No pudimos guardar el archivo." },
      { status: 400 },
    );
  }

  const stored = uploaded as { url: string; key: string };
  const { data, error } = await insforge.database
    .from("product_attachments")
    .insert([
      {
        sku,
        file_name: file.name,
        file_url: stored.url,
        file_key: stored.key,
        mime_type: file.type,
        size_bytes: file.size,
        uploaded_by: profile.id,
      },
    ])
    .select("id")
    .single();
  if (error) {
    await insforge.storage.from("product-documents").remove(stored.key);
    return NextResponse.json({ message: error.message }, { status: 400 });
  }
  await insforge.database.from("audit_events").insert([
    {
      actor_id: profile.id,
      action: "attachment.created",
      entity_type: "product_attachment",
      entity_id: String((data as { id: string }).id),
      details: { sku, file_name: file.name, file_key: stored.key },
    },
  ]);
  return NextResponse.json({ data });
}
