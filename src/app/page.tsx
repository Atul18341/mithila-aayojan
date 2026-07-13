import Image from "next/image";
import type { Metadata } from "next";
import Navbar from "@/components/Navbar";
import Hero from "@/components/Hero";
import Features from "@/components/Features";
import Solutions from "@/components/Solutions";
import TrustSeals from "@/components/TrustSeals";
import Halal from "@/components/Halal";
import CTA from "@/components/CTA";
export const metadata: Metadata = {
  title: "Mithila Aayojan",
  description: "Smart Event Management Platform by LYSS Technology",
};
export default function Home() {
  return (
      <main>
        <Navbar />
        <Hero />
        <Features />
        <Solutions />
        <TrustSeals/>
        <Halal/>
        <CTA />
      </main>
     
  );
}
