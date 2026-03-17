import { createContext, useContext, useState, ReactNode, useMemo } from "react";
import type { ETF } from "@/types/etf";

type EtfDeepDiveTabId =
  | "summary"
  | "dividends"
  | "performance"
  | "holdings"
  | "expenses"
  | "riskTax"
  | "newsFilings";

interface EtfDeepDiveState {
  isOpen: boolean;
  ticker: string | null;
  baseEtf: ETF | null;
  activeTab: EtfDeepDiveTabId;
}

interface EtfDeepDiveContextValue extends EtfDeepDiveState {
  openDeepDive: (params: { ticker: string; baseEtf?: ETF | null; initialTab?: EtfDeepDiveTabId }) => void;
  closeDeepDive: () => void;
  setActiveTab: (tab: EtfDeepDiveTabId) => void;
}

const EtfDeepDiveContext = createContext<EtfDeepDiveContextValue | undefined>(undefined);

interface EtfDeepDiveProviderProps {
  children: ReactNode;
}

export function EtfDeepDiveProvider({ children }: EtfDeepDiveProviderProps) {
  const [state, setState] = useState<EtfDeepDiveState>({
    isOpen: false,
    ticker: null,
    baseEtf: null,
    activeTab: "summary",
  });

  const openDeepDive: EtfDeepDiveContextValue["openDeepDive"] = ({
    ticker,
    baseEtf = null,
    initialTab,
  }) => {
    setState((prev) => ({
      ...prev,
      isOpen: true,
      ticker,
      baseEtf: baseEtf ?? prev.baseEtf,
      activeTab: initialTab ?? "summary",
    }));
  };

  const closeDeepDive = () => {
    setState((prev) => ({
      ...prev,
      isOpen: false,
    }));
  };

  const setActiveTab = (tab: EtfDeepDiveTabId) => {
    setState((prev) => ({
      ...prev,
      activeTab: tab,
    }));
  };

  const value = useMemo<EtfDeepDiveContextValue>(
    () => ({
      ...state,
      openDeepDive,
      closeDeepDive,
      setActiveTab,
    }),
    [state],
  );

  return <EtfDeepDiveContext.Provider value={value}>{children}</EtfDeepDiveContext.Provider>;
}

export function useEtfDeepDive() {
  const ctx = useContext(EtfDeepDiveContext);
  if (!ctx) {
    throw new Error("useEtfDeepDive must be used within an EtfDeepDiveProvider");
  }
  return ctx;
}

export type { EtfDeepDiveTabId };

