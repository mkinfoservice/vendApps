import React from "react";
import ReactDOM from "react-dom/client";
import "./index.css";
import { CartProvider } from "./features/cart/cart";
import { AppRoutes } from "./routes";


import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 30_000,
      refetchOnWindowFocus: false,
    },
  },
});

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
  <CartProvider>
    <AppRoutes/>
  </CartProvider>
</QueryClientProvider>
  </React.StrictMode>
);
