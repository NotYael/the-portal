import type { Metadata } from "next";
import { JobsView } from "@/features/jobs/jobs-view";

export const metadata: Metadata = { title: "Job agent" };

export default function JobsPage() {
  return <JobsView />;
}
