export type GlobalSearchProduct = {
  sku: string;
  productName: string;
  productLine: string;
  available: number;
  href: string;
};

export type GlobalSearchLine = {
  productLine: string;
  href: string;
};

export type GlobalSearchOrder = {
  id: string;
  orderNumber: string;
  supplierName: string;
  status: "draft" | "ordered" | "received" | "cancelled";
  href: string;
};

export type GlobalSearchResults = {
  products: GlobalSearchProduct[];
  lines: GlobalSearchLine[];
  orders: GlobalSearchOrder[];
};
