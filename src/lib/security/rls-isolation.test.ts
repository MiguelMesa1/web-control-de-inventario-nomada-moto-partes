import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const inventoryMigration = readFileSync(
  resolve("migrations/20260729153138_inventory-mvp.sql"),
  "utf8",
);
const ownershipMigration = readFileSync(
  resolve("migrations/20260824143000_restrict-attachment-deletion-to-owner.sql"),
  "utf8",
);
const asvsMigration = readFileSync(
  resolve("migrations/20260824202130_asvs-security-hardening.sql"),
  "utf8",
);

describe("RLS user resource isolation", () => {
  it("solo expone un perfil a su propietario salvo permiso administrativo", () => {
    expect(inventoryMigration).toMatch(
      /CREATE POLICY profiles_select[\s\S]*?id = \(SELECT auth\.uid\(\)\)[\s\S]*?is_inventory_admin\(\)/,
    );
  });

  it("limita el borrado de metadatos al propietario o a un administrador", () => {
    expect(ownershipMigration).toMatch(
      /CREATE POLICY attachments_delete_internal[\s\S]*?is_inventory_admin\(\)[\s\S]*?uploaded_by = \(SELECT auth\.uid\(\)\)/,
    );
  });

  it("aplica el mismo aislamiento al objeto físico almacenado", () => {
    expect(ownershipMigration).toMatch(
      /CREATE POLICY product_documents_delete[\s\S]*?is_inventory_admin\(\)[\s\S]*?uploaded_by = \(SELECT auth\.jwt\(\) ->> 'sub'\)/,
    );
  });

  it("impide que los clientes inserten o alteren directamente la auditoría", () => {
    expect(asvsMigration).toMatch(
      /REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public\.audit_events FROM anon, authenticated/,
    );
  });

  it("mantiene los límites y eventos de seguridad fuera de los roles públicos", () => {
    expect(asvsMigration).toMatch(
      /REVOKE ALL ON public\.security_rate_limits FROM PUBLIC, anon, authenticated/,
    );
    expect(asvsMigration).toMatch(
      /REVOKE ALL ON public\.security_events FROM PUBLIC, anon, authenticated/,
    );
    expect(asvsMigration).toMatch(
      /SECURITY DEFINER[\s\S]*?SET search_path = pg_catalog, public, pg_temp/,
    );
    expect(asvsMigration).toMatch(
      /REVOKE ALL ON FUNCTION public\.consume_security_rate_limit\(text, integer, integer\)[\s\S]*?FROM PUBLIC, anon, authenticated/,
    );
  });
});
