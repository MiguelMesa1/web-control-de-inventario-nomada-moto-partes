const PURCHASE_CART_STORAGE_PREFIX = "nomada:purchase-cart:v2";

export function purchaseCartStorageKey(userId: string) {
  return `${PURCHASE_CART_STORAGE_PREFIX}:${userId}`;
}
