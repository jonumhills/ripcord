import { useEffect, useState } from "react";
import { Onboarding } from "./screens/Onboarding";
import { RiskAssessment } from "./screens/RiskAssessment";
import { Quote } from "./screens/Quote";
import { loadAddresses, saveAddresses } from "./lib/storage";
import { onWalletConnected } from "./lib/wallet";

type Step = "onboard" | "risk" | "quote";

export default function App() {
  const [step, setStep] = useState<Step>("onboard");
  const [addresses, setAddresses] = useState<string[]>([]);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    loadAddresses().then((saved) => {
      setAddresses(saved);
      setHydrated(true);
    });
  }, []);

  useEffect(() => {
    if (hydrated) saveAddresses(addresses);
  }, [addresses, hydrated]);

  useEffect(() => {
    return onWalletConnected((address) => {
      setAddresses((prev) => (prev.includes(address) ? prev : [...prev, address.toLowerCase()]));
    });
  }, []);

  return (
    <div className="bg-bg text-fg min-h-full">
      <header className="flex items-center gap-2 px-4 py-3 border-b border-border">
        <span className="font-display font-semibold text-base text-primary">Ripcord</span>
        <span className="label-caps">Wallet cover</span>
      </header>

      {step === "onboard" && (
        <Onboarding
          addresses={addresses}
          onAddAddress={(a) => setAddresses((prev) => [...prev, a])}
          onRemoveAddress={(a) => setAddresses((prev) => prev.filter((x) => x !== a))}
          onContinue={() => setStep("risk")}
        />
      )}

      {step === "risk" && (
        <RiskAssessment addresses={addresses} onBack={() => setStep("onboard")} onContinue={() => setStep("quote")} />
      )}

      {step === "quote" && <Quote addresses={addresses} onBack={() => setStep("risk")} />}
    </div>
  );
}
