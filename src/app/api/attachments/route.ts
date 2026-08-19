import { NextResponse } from "next/server";
import { createInsForgeServerClient } from "@/lib/insforge/server";
import { getAppProfile } from "@/lib/insforge/session";
import { sanitizeText } from "@/lib/security/input";
import { requireMultipartRequest } from "@/lib/security/request";

const allowedMimeTypes = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
]);

async function matchesDeclaredFileType(file: File) {
  const bytes = new Uint8Array(await file.slice(0, 12).arrayBuffer());
  if (file.type === "application/pdf") return String.fromCharCode(...bytes.slice(0, 5)) === "%PDF-";
  if (file.type === "image/jpeg") return bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  if (file.type === "image/png") return [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a].every((value, index) => bytes[index] === value);
  if (file.type === "image/webp") return String.fromCharCode(...bytes.slice(0, 4)) === "RIFF" && String.fromCharCode(...bytes.slice(8, 12)) === "WEBP";
  return false;
}

export async function GET(request: Request) {
  const profile = await getAppProfile();
  if (profile.role !== "admin" && profile.role !== "uploader") {
    return NextResponse.json(
      { message: "No tienes acceso a documentos internos." },
      { status: 403 },
    );
  }
  const sku = sanitizeText(new URL(request.url).searchParams.get("sku"), { maxLength: 120 });
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
  const requestError = requireMultipartRequest(request, 16 * 1024 * 1024);
  if (requestError) return requestError;
  const profile = await getAppProfile();
  if (profile.role !== "admin" && profile.role !== "uploader") {
    return NextResponse.json({ message: "No tienes acceso a documentos internos." }, { status: 403 });
  }
  const formData = await request.formData();
  const sku = sanitizeText(formData.get("sku"), { maxLength: 120 });
  const file = formData.get("file");
  if (!sku || !(file instanceof File)) {
    return NextResponse.json({ message: "Faltan el SKU o el archivo." }, { status: 400 });
  }
  if (!allowedMimeTypes.has(file.type)) {
    return NextResponse.json({ message: "Usa PDF, JPG, PNG o WebP." }, { status: 415 });
  }
  if (!(await matchesDeclaredFileType(file))) {
    return NextResponse.json({ message: "El contenido del archivo no coincide con su formato." }, { status: 415 });
  }
  if (file.size > 15 * 1024 * 1024) {
    return NextResponse.json({ message: "El archivo supera 15 MB." }, { status: 413 });
  }

  const originalName = sanitizeText(file.name, { maxLength: 180 });
  if (!originalName) {
    return NextResponse.json({ message: "El nombre del archivo no es válido." }, { status: 400 });
  }
  const safeName = originalName.replace(/[^a-zA-Z0-9._-]+/g, "-").slice(-120) || "archivo";
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
        file_name: originalName,
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
      details: { sku, file_name: originalName, file_key: stored.key },
    },
  ]);
  return NextResponse.json({ data });
}
