import { Nav } from "@/components/Nav";
import { Footer } from "@/components/Footer";
import { Hero, HowItWorks } from "@/components/marketing/Hero";
import { TrustSection, Pricing } from "@/components/marketing/TrustPricing";

export default function HomePage() {
  return (
    <>
      <Nav />
      <main>
        <Hero />
        <HowItWorks />
        <TrustSection />
        <Pricing />
      </main>
      <Footer />
    </>
  );
}
