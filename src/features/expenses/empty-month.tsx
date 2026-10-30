import { Button } from "@/components/ui/button";
import { monthLong } from "@/lib/format";
import type { MonthKey } from "@/lib/types";

export function EmptyMonth({
  month,
  firstMonth,
  onGoFirst,
  onAdd,
}: {
  month: MonthKey;
  firstMonth: MonthKey | null;
  onGoFirst: () => void;
  onAdd: () => void;
}) {
  const beforeRecords = firstMonth !== null && month < firstMonth;
  return (
    <section
      aria-label="No expenses"
      className="flex flex-col items-center gap-3 rounded-[16px] border border-dashed border-line-strong bg-surface px-6 py-12 text-center"
    >
      <h2 className="m-0 font-display text-[22px] font-bold">No expenses in {monthLong(month)}</h2>
      <p className="m-0 text-[15px] text-muted">
        {beforeRecords ? `Your records start in ${monthLong(firstMonth!)}.` : "Nothing logged this month yet."}
      </p>
      <div className="flex flex-wrap justify-center gap-2">
        {beforeRecords ? <Button onClick={onGoFirst}>Go to {monthLong(firstMonth!)}</Button> : null}
        <Button variant="primary" onClick={onAdd}>
          + Add an expense
        </Button>
      </div>
    </section>
  );
}
