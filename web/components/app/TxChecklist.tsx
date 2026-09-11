export type TxStepStatus = "pending" | "active" | "done" | "error";

export interface TxStep {
  id: string;
  label: string;
  status: TxStepStatus;
  detail?: string;
  href?: string; // e.g. an Arcscan link for a tx hash
}

const DOT_CLASS: Record<TxStepStatus, string> = {
  pending: "border border-border text-muted",
  active: "border border-primary text-primary",
  done: "bg-primary text-on-primary",
  error: "bg-no-bg text-no-fg",
};

/** Live progress checklist for the bind flow — wallet confirmed, risk analyzed, premium
 * calculated, balance verified, approval signed, bind confirmed on Arc. Each step shows real
 * detail (a short address, a dollar amount, a tx hash linked to the explorer) rather than a
 * generic spinner, so anyone watching (including on camera for the hackathon demo) can see
 * exactly what's happening and verify it independently. */
export function TxChecklist({ steps }: { steps: TxStep[] }) {
  return (
    <ul className="flex flex-col gap-3">
      {steps.map((s) => (
        <li key={s.id} className="flex items-start gap-3">
          <span
            className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold transition-colors duration-200 ${DOT_CLASS[s.status]} ${s.status === "active" ? "animate-pulse" : ""}`}
          >
            {s.status === "done" ? "✓" : s.status === "error" ? "!" : ""}
          </span>
          <div className="flex-1 min-w-0">
            <p className={`text-sm ${s.status === "pending" ? "text-muted" : "text-fg"}`}>{s.label}</p>
            {s.detail &&
              (s.href ? (
                <a
                  href={s.href}
                  target="_blank"
                  rel="noreferrer"
                  className="text-xs text-primary hover:underline font-mono break-all"
                >
                  {s.detail} ↗
                </a>
              ) : (
                <p className="text-xs text-muted font-mono break-all">{s.detail}</p>
              ))}
          </div>
        </li>
      ))}
    </ul>
  );
}
