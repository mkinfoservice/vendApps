import React, { createContext, useContext, useEffect, useMemo, useReducer } from "react";
import type { Product } from "../catalog/api";

type CartItem = { product: Product; qty: number };

type State = { items: CartItem[] };

type Action =
  | { type: "ADD"; product: Product }
  | { type: "INC"; productId: string }
  | { type: "DEC"; productId: string }
  | { type: "REMOVE"; productId: string }
  | { type: "CLEAR" }
  | { type: "SET"; items: CartItem[] };

type CartApi = {
    items: CartItem[];
    add: (p: Product) => void;
    inc: (id: string) => void;
    dec: (id: string) => void;
    remove: (id: string) => void;
    clear: () => void;
    subtotalCents: number;
    totalItems: number;
}

const STORAGE_KEY = "petshop_cart_v1";

function reducer(state: State, action: Action): State {
    switch (action.type) {
        case "SET":
            return { items: action.items };
        case "ADD": {
            const idx = state.items.findIndex(i => i.product.id === action.product.id);
            if (idx >= 0) {
                const items = state.items.map((i) => i.product.id === action.product.id ? { ...i, qty: i.qty + 1 } : i);
                return { items };
            }
            return { items: [...state.items, { product: action.product, qty: 1 }] };
        }
        case "INC": {
            return {
                items: state.items.map((i) => i.product.id === action.productId ? { ...i, qty: i.qty + 1 } : i)
            };
        }
        case "DEC": {
            return {
                items: state.items
                    .map((i) => i.product.id === action.productId ? { ...i, qty: i.qty - 1 } : i)
                    .filter((i) => i.qty > 0)
            };
        }
        case "REMOVE": {
            return {
                items: state.items.filter((i) => i.product.id !== action.productId)
            };
        }
        case "CLEAR": {
            return { items: [] };
        }
        default:
            return state;
    }
}

const CartContext = createContext<CartApi | null>(null);

export function CartProvider({ children }: { children: React.ReactNode }) {
    const [state, dispatch] = useReducer(reducer, { items: [] });

    // Carrega do localStorage ao iniciar
    useEffect(() => {
        try {
            const raw = localStorage.getItem(STORAGE_KEY);
            if (!raw) return;
            const parsed = JSON.parse(raw) as CartItem[];
            dispatch({ type: "SET", items: parsed });
        } catch {
            localStorage.removeItem(STORAGE_KEY);
        }
    }, []);

    // Salva sempre que items mudar
    useEffect(() => {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(state.items));
    }, [state.items]);

    const subtotalCents = useMemo(
        () => state.items.reduce((acc, i) => acc + i.product.priceCents * i.qty, 0),
        [state.items]
    );
    const totalItems = useMemo(
        () => state.items.reduce((acc, i) => acc + i.qty, 0),
        [state.items]
    );

    const api: CartApi = useMemo(
        () => ({
            items: state.items,
            add: (p) => dispatch({ type: "ADD", product: p }),
            inc: (id) => dispatch({ type: "INC", productId: id }),
            dec: (id) => dispatch({ type: "DEC", productId: id }),
            remove: (id) => dispatch({ type: "REMOVE", productId: id }),
            clear: () => dispatch({ type: "CLEAR" }),
            subtotalCents,
            totalItems,
        }),
        [state.items, subtotalCents, totalItems]
    );

    return <CartContext.Provider value={api}>{children}</CartContext.Provider>;
}

export function useCart() {
    const ctx = useContext(CartContext);
    if (!ctx) {
        throw new Error("useCart must be used within a CartProvider");
    }
    return ctx;
}