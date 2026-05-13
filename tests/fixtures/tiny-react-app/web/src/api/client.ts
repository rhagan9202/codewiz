export const apiClient = {
  postCartItem: (item: { productId: string; quantity: number }) =>
    fetch("/cart/items", { method: "POST", body: JSON.stringify(item) }),
  getProducts: () => fetch("/products"),
};
