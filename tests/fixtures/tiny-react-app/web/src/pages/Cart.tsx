import { Button } from "../components/Button";
import { apiClient } from "../api/client";
import type { CartItem } from "../types/CartItem";

export default function Cart() {
  const item: CartItem = { productId: "p_1", quantity: 1 };
  return <Button label="Add" onClick={() => { void apiClient.postCartItem(item); }} />;
}
