import { Navbar } from "./components/balary/Navbar";
import { Hero } from "./components/balary/Hero";
import { ProductOverview } from "./components/balary/ProductOverview";
import { HowItWorks } from "./components/balary/HowItWorks";
import {
  EmployerSection,
  EmployeeSection,
} from "./components/balary/UserSections";
import { Security } from "./components/balary/Security";
import { Faq } from "./components/balary/Faq";
import { FinalCta } from "./components/balary/FinalCta";
import { Footer } from "./components/balary/Footer";

export function NewLandingPage() {
  return (
    <div className="relative min-h-screen overflow-x-hidden bg-background text-foreground zl-landing">
      <div className="pointer-events-none fixed inset-0 -z-10">
        <div className="absolute left-[10%] top-[20%] h-[500px] w-[500px] rounded-full bg-primary/5 blur-[160px]" />
        <div className="absolute right-[5%] top-[60%] h-[400px] w-[400px] rounded-full bg-primary/3 blur-[140px]" />
      </div>

      <Navbar />

      <main>
        <Hero />
        <ProductOverview />
        <HowItWorks />
        <EmployerSection />
        <EmployeeSection />
        <Security />
        <Faq />
        <FinalCta />
      </main>

      <Footer />
    </div>
  );
}
