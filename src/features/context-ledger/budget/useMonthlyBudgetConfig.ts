import { useEffect, useMemo, useState } from "react";
import type { MonthlyBudgetConfig } from "./budgetTypes";
import { budgetStoreInternals, createMonthlyBudgetStore } from "./budgetStore";

const monthlyBudgetStore = createMonthlyBudgetStore();

export function useMonthlyBudgetConfig(): readonly [
  MonthlyBudgetConfig,
  {
    readonly setMonthlyLimitUsd: (value: number | null) => void;
    readonly clear: () => void;
    readonly degraded: boolean;
  },
] {
  const [config, setConfig] = useState(() => monthlyBudgetStore.get());
  const [degraded, setDegraded] = useState(() => monthlyBudgetStore.degraded());

  useEffect(() => {
    function refresh() {
      setConfig(monthlyBudgetStore.get());
      setDegraded(monthlyBudgetStore.degraded());
    }
    window.addEventListener(
      budgetStoreInternals.MONTHLY_BUDGET_CHANGE_EVENT,
      refresh,
    );
    window.addEventListener("storage", refresh);
    window.addEventListener("localStorageChange", refresh);
    return () => {
      window.removeEventListener(
        budgetStoreInternals.MONTHLY_BUDGET_CHANGE_EVENT,
        refresh,
      );
      window.removeEventListener("storage", refresh);
      window.removeEventListener("localStorageChange", refresh);
    };
  }, []);

  const actions = useMemo(
    () => ({
      setMonthlyLimitUsd(value: number | null) {
        monthlyBudgetStore.set({
          ...monthlyBudgetStore.get(),
          monthlyLimitUsd: value == null ? null : Math.max(value, 0),
        });
        setConfig(monthlyBudgetStore.get());
        setDegraded(monthlyBudgetStore.degraded());
      },
      clear() {
        monthlyBudgetStore.clear();
        setConfig(monthlyBudgetStore.get());
        setDegraded(monthlyBudgetStore.degraded());
      },
      degraded,
    }),
    [degraded],
  );

  return [config, actions] as const;
}
