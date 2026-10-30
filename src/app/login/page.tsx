import type { Metadata } from "next";
import { LogoMark } from "@/components/shell/logo";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Log in" };

const TOOLS = ["Expense tracker", "Goal tracker", "Job agent", "Journal", "Weekly digest"];

export default function LoginPage() {
  return (
    <div className="flex min-h-dvh flex-wrap bg-bg">
      <section className="flex flex-[1_1_420px] flex-col justify-between gap-12 bg-panel p-8 text-white sm:p-12">
        <div className="flex items-center gap-3">
          <LogoMark size={36} inverted />
          <span className="font-display text-[22px] font-bold">The Portal</span>
        </div>
        <div className="flex max-w-[520px] flex-col gap-5">
          <h1 className="m-0 font-display text-[40px] leading-[1.02] font-bold tracking-[-0.03em] sm:text-[56px]">
            Everything you run, behind one door.
          </h1>
          <p className="m-0 text-[17px] leading-relaxed text-dark-muted">
            Expenses, goals, job hunting and journaling in one private workspace — with a weekly recap of your wins and
            next targets in your inbox every Sunday.
          </p>
        </div>
        <ul className="m-0 flex list-none flex-wrap gap-2 p-0">
          {TOOLS.map((tool) => (
            <li key={tool} className="rounded-full border border-dark-line px-3 py-2 text-[13px] text-[#D5D9E0]">
              {tool}
            </li>
          ))}
        </ul>
      </section>

      <section className="flex flex-[1_1_420px] items-center justify-center px-6 py-12">
        <LoginForm />
      </section>
    </div>
  );
}
