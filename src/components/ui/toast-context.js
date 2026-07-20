/* Toast context + hook — separate from Toast.jsx so that file only exports
   components (react-refresh requirement). */
import { createContext, useContext } from "react";

export const ToastCtx = createContext(null);

export function useToast() {
  const t = useContext(ToastCtx);
  if (!t) throw new Error("useToast requires <ToastProvider> above it");
  return t;
}
