import { AiShowcase } from "@/components/home/AiShowcase";
import { CtaBand } from "@/components/home/CtaBand";
import { Hero } from "@/components/home/Hero";
import { HowItWorks } from "@/components/home/HowItWorks";
import { Installations } from "@/components/home/Installations";

export default function Home() {
  return (
    <main>
      <Hero />
      <AiShowcase />
      <Installations />
      <HowItWorks />
      <CtaBand />
    </main>
  );
}
