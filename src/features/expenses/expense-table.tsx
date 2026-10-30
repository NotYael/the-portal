"use client";

import { useState } from "react";
import { FilterChip } from "@/components/ui/chip";
import { Dot } from "@/components/ui/dot";
import { sumAmounts } from "@/lib/expense-stats";
import { monthLong, peso, pesoExact, shortDate } from "@/lib/format";
import { useAmountsHidden } from "@/lib/use-amounts-hidden";
import { PAYMENT_LABELS, type Category, type Expense, type ISODate, type MonthKey } from "@/lib/types";
import { EditDrawer } from "./edit-drawer";

const th = "sticky top-0 z-[1] bg-subtle px-4 py-3 text-xs font-semibold text-muted border-b border-line";
const td = "px-4 py-3 border-b border-divider";
const mobileRow = "flex w-full items-center justify-between gap-3 py-3";

export function ExpenseTable({
  month,
  rows,
  categories,
  today,
}: {
  month: MonthKey;
  rows: Expense[];
  categories: Category[];
  today: ISODate;
}) {
  const [filter, setFilter] = useState<string>("all");
  const [editing, setEditing] = useState<Expense | null>(null);
  // The edit drawer shows the amount, so rows can't be opened while amounts are hidden.
  const locked = useAmountsHidden();
  const byId = new Map(categories.map((c) => [c.id, c]));

  const shown = rows
    .filter((e) => filter === "all" || e.category_id === filter)
    .sort((a, b) => b.spent_on.localeCompare(a.spent_on) || b.created_at.localeCompare(a.created_at));
  const emptyText = `No ${byId.get(filter)?.label.toLowerCase() ?? ""} expenses this month.`;

  return (
    <section aria-labelledby="table-title" className="flex flex-col gap-4 rounded-[16px] border border-line bg-surface p-4 sm:p-6">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h2 id="table-title" className="m-0 font-display text-xl font-bold">
          {monthLong(month)} expenses
        </h2>
        <span className="text-sm text-muted" aria-live="polite">
          {shown.length} shown · <span className="font-mono text-ink">{peso(sumAmounts(shown))}</span>
        </span>
      </div>

      <div
        role="group"
        aria-label="Filter by category"
        className="-mx-4 flex gap-1.5 overflow-x-auto px-4 [scrollbar-width:none] sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0"
      >
        <FilterChip pressed={filter === "all"} onClick={() => setFilter("all")} color="var(--border-strong)">
          All
        </FilterChip>
        {categories.map((c) => (
          <FilterChip key={c.id} pressed={filter === c.id} onClick={() => setFilter(c.id)} color={c.color}>
            {c.label}
          </FilterChip>
        ))}
      </div>

      {/* Phones get a stacked list: the table's Amount column would sit off-screen. */}
      <ul className="m-0 list-none p-0 sm:hidden">
        {shown.length === 0 ? (
          <li className="border-t border-divider py-8 text-center text-sm text-muted">{emptyText}</li>
        ) : (
          shown.map((e) => {
            const cat = byId.get(e.category_id);
            const body = (
              <>
                <span className="min-w-0">
                  <span className="block truncate text-sm font-medium text-ink">{e.description}</span>
                  <span className="mt-0.5 flex min-w-0 items-center gap-1.5 text-[13px] text-muted">
                    {cat ? <Dot color={cat.color} /> : null}
                    <span className="truncate">
                      {cat?.label ?? "—"} · {shortDate(e.spent_on)} · {PAYMENT_LABELS[e.payment_method]}
                    </span>
                  </span>
                </span>
                <span className="shrink-0 font-mono text-sm">{pesoExact(e.amount)}</span>
              </>
            );
            return (
              <li key={e.id} className="border-t border-divider">
                {locked ? (
                  <div className={mobileRow}>{body}</div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setEditing(e)}
                    aria-label={`Edit ${e.description}, ${pesoExact(e.amount)} on ${shortDate(e.spent_on)}`}
                    className={`${mobileRow} cursor-pointer text-left`}
                  >
                    {body}
                  </button>
                )}
              </li>
            );
          })
        )}
      </ul>

      <div className="hidden max-h-[560px] overflow-auto rounded-[12px] border border-divider sm:block">
        <table className="w-full min-w-[640px] border-collapse text-sm">
          <thead>
            <tr>
              <th scope="col" className={`${th} text-left`}>Date</th>
              <th scope="col" className={`${th} text-left`}>Description</th>
              <th scope="col" className={`${th} text-left`}>Category</th>
              <th scope="col" className={`${th} text-left`}>Paid with</th>
              <th scope="col" className={`${th} text-right`}>Amount</th>
            </tr>
          </thead>
          <tbody>
            {shown.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-10 text-center text-muted">
                  {emptyText}
                </td>
              </tr>
            ) : (
              shown.map((e) => {
                const cat = byId.get(e.category_id);
                return (
                  <tr key={e.id} onClick={locked ? undefined : () => setEditing(e)} className={locked ? undefined : "cursor-pointer hover:bg-subtle"}>
                    <td className={`${td} whitespace-nowrap text-muted`}>{shortDate(e.spent_on)}</td>
                    <td className={td}>
                      {locked ? (
                        e.description
                      ) : (
                        <button
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation();
                            setEditing(e);
                          }}
                          className="cursor-pointer text-left text-ink hover:underline"
                          aria-label={`Edit ${e.description}, ${pesoExact(e.amount)} on ${shortDate(e.spent_on)}`}
                        >
                          {e.description}
                        </button>
                      )}
                    </td>
                    <td className={td}>
                      <span className="inline-flex items-center gap-1.5 text-[13px]">
                        {cat ? <Dot color={cat.color} /> : null}
                        {cat?.label ?? "—"}
                      </span>
                    </td>
                    <td className={`${td} text-muted`}>{PAYMENT_LABELS[e.payment_method]}</td>
                    <td className={`${td} text-right font-mono`}>{pesoExact(e.amount)}</td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <EditDrawer expense={editing} categories={categories} today={today} onClose={() => setEditing(null)} />
    </section>
  );
}
