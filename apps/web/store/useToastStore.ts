import { create } from "zustand";

type Toast = {
  id: string;
  message: string;
  type: "success" | "error" | "info";
  duration?: number;
};

type ToastState = {
  toasts: Toast[];
  toast: (message: string, type?: Toast["type"], duration?: number) => void;
  dismiss: (id: string) => void;
};

let nextId = 0;

export const useToastStore = create<ToastState>()((set) => ({
  toasts: [],
  toast: (message, type = "info", duration = 3000) => {
    const id = `toast-${++nextId}`;
    set((s) => ({ toasts: [...s.toasts, { id, message, type, duration }] }));
    if (duration > 0) {
      setTimeout(() => {
        set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) }));
      }, duration);
    }
  },
  dismiss: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}));
