import type { Metadata } from "next";
import { DigestView } from "@/features/digest/digest-view";

export const metadata: Metadata = { title: "Weekly digest" };

export default function DigestPage() {
  return <DigestView />;
}
