"use client";
import { createContext, useCallback, useContext, useState } from "react";
import { NewBookingSheet } from "./new-booking-sheet";

export interface NewBookingPrefill {
  startAt?: number;
  clientId?: string;
  // Carried over when booking straight from a converted lead.
  description?: string;
  quotedPriceKes?: number;
  extras?: string[];
}

const Ctx = createContext<{ open: (prefill?: NewBookingPrefill) => void }>({ open: () => {} });

export function NewBookingProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<{ open: boolean; prefill?: NewBookingPrefill; key: number }>({ open: false, key: 0 });
  const open = useCallback((prefill?: NewBookingPrefill) => setState((s) => ({ open: true, prefill, key: s.key + 1 })), []);
  return (
    <Ctx.Provider value={{ open }}>
      {children}
      <NewBookingSheet
        key={state.key}
        open={state.open}
        prefill={state.prefill}
        onOpenChange={(o) => setState((s) => ({ ...s, open: o }))}
      />
    </Ctx.Provider>
  );
}

export const useNewBooking = () => useContext(Ctx);
