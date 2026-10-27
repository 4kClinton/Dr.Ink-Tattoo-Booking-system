"use client";
import { addDaysEAT, fromDateKey } from "@drink/shared";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useMemo } from "react";
import { type DateRange, presetRange } from "@/components/ui/date-range-picker";

const KEY_RE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * The reports period lives in the URL (?from=YYYY-MM-DD&to=YYYY-MM-DD, inclusive) so it survives
 * drilling into a card and coming back. Defaults to this month. Callers need a <Suspense> boundary.
 */
export function useReportRange() {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const rawFrom = params.get("from");
  const rawTo = params.get("to");

  return useMemo(() => {
    const valid = rawFrom && rawTo && KEY_RE.test(rawFrom) && KEY_RE.test(rawTo) && rawFrom <= rawTo;
    const range: DateRange = valid ? { from: rawFrom, to: rawTo } : presetRange("month");
    const search = `from=${range.from}&to=${range.to}`;
    return {
      range,
      search,
      /** [from, to) epoch ms for Convex queries. */
      from: fromDateKey(range.from),
      to: addDaysEAT(fromDateKey(range.to), 1),
      setRange: (r: DateRange) => router.replace(`${pathname}?from=${r.from}&to=${r.to}`, { scroll: false }),
    };
  }, [rawFrom, rawTo, router, pathname]);
}
