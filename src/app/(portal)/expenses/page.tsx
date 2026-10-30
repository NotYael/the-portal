import type { Metadata } from "next";
import { Suspense } from "react";
import { PageSkeleton } from "@/components/ui/skeleton";
import { ExpensesView } from "@/features/expenses/expenses-view";

export const metadata: Metadata = { title: "Expenses" };

export default function ExpensesPage() {
  return (
    <Suspense fallback={<PageSkeleton cards={6} label="Loading expenses" />}>
      <ExpensesView />
    </Suspense>
  );
}
