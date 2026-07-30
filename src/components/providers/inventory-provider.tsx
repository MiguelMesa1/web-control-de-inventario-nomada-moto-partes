"use client";

import { createContext, useContext } from "react";
import type { InventoryData } from "@/types/inventory";

const InventoryContext = createContext<InventoryData | null>(null);

export function InventoryProvider({
  value,
  children,
}: {
  value: InventoryData;
  children: React.ReactNode;
}) {
  return (
    <InventoryContext.Provider value={value}>
      {children}
    </InventoryContext.Provider>
  );
}

export function useInventoryData() {
  const value = useContext(InventoryContext);
  if (!value) {
    throw new Error("useInventoryData must be used inside InventoryProvider");
  }
  return value;
}
