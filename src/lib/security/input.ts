import { NextResponse } from "next/server";

type TextOptions = {
  allowEmpty?: boolean;
  multiline?: boolean;
  maxLength: number;
};

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const UNSAFE_UNICODE = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f-\u009f\u202a-\u202e\u2066-\u2069]/g;

export function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return false;
  }
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

export async function readJsonObject(request: Request) {
  try {
    const value: unknown = await request.json();
    if (!isPlainObject(value)) {
      throw new Error("not-an-object");
    }
    return { data: value, error: null };
  } catch {
    return {
      data: null,
      error: NextResponse.json(
        { message: "El cuerpo JSON no es válido." },
        { status: 400 },
      ),
    };
  }
}

export function sanitizeText(value: unknown, options: TextOptions) {
  if (typeof value !== "string") return null;

  let normalized = value.normalize("NFKC").replace(UNSAFE_UNICODE, "");
  normalized = options.multiline
    ? normalized
        .replace(/\r\n?/g, "\n")
        .replace(/[\t ]+/g, " ")
        .replace(/\n{3,}/g, "\n\n")
        .trim()
    : normalized.replace(/\s+/g, " ").trim();

  if ((!options.allowEmpty && !normalized) || normalized.length > options.maxLength) {
    return null;
  }
  return normalized;
}

export function sanitizeOptionalText(
  value: unknown,
  options: Omit<TextOptions, "allowEmpty">,
) {
  if (value === undefined || value === null || value === "") return null;
  return sanitizeText(value, { ...options, allowEmpty: false });
}

export function sanitizeEmail(value: unknown) {
  const email = sanitizeText(value, { maxLength: 254 });
  if (!email || !EMAIL_PATTERN.test(email)) return null;
  return email.toLocaleLowerCase("en-US");
}

export function sanitizeUuid(value: unknown) {
  const id = sanitizeText(value, { maxLength: 36 });
  return id && UUID_PATTERN.test(id) ? id.toLocaleLowerCase("en-US") : null;
}

export function parseFiniteNumber(
  value: unknown,
  options: { integer?: boolean; min: number; max: number },
) {
  if (typeof value !== "number" && typeof value !== "string") return null;
  if (typeof value === "string" && !/^-?\d+(?:\.\d+)?$/.test(value.trim())) {
    return null;
  }
  const number = Number(value);
  if (
    !Number.isFinite(number) ||
    (options.integer && !Number.isInteger(number)) ||
    number < options.min ||
    number > options.max
  ) {
    return null;
  }
  return number;
}

export function isBoolean(value: unknown): value is boolean {
  return typeof value === "boolean";
}
