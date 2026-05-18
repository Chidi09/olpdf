"use client";

import React from "react";
import { Button } from "@/components/ui/button";
import { ChevronRight, ChevronLeft, X, Star, Sparkles } from "lucide-react";
import { useWalkthroughStore } from "@/store/useWalkthroughStore";

const steps = [
  {
    title: "Welcome to OLPDF",
    description: "The structure-first AI document operating system. We're glad you're here to build something great.",
    icon: <Star className="w-8 h-8 text-amber-500" />,
  },
  {
    title: "Structure First",
    description: "OLPDF reconstructs your document's layout deterministically before AI ever touches it. You're always in control of the structure.",
    icon: <div className="w-8 h-8 rounded border-2 border-amber-500 flex items-center justify-center font-bold text-amber-500">1</div>,
  },
  {
    title: "Targeted AI",
    description: "Use Gemini to rewrite, summarize, or expand your content. AI suggestions are always presented for your review before being applied.",
    icon: <Sparkles className="w-8 h-8 text-amber-500" />,
  },
  {
    title: "Professional Publishing",
    description: "Export your work to PDF/A-1b for archival, Tagged PDF for accessibility, or KDP-ready EPUB3 for your next book.",
    icon: <div className="w-8 h-8 text-amber-500 font-bold flex items-center">PDF</div>,
  },
];

export default function OnboardingWalkthrough({ onComplete }: { onComplete: () => void }) {
  const { currentStep, setCurrentStep } = useWalkthroughStore();

  const next = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      onComplete();
    }
  };

  const prev = () => {
    if (currentStep > 0) setCurrentStep(currentStep - 1);
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-[100] flex items-center justify-center p-4">
      <div className="bg-[var(--bg-elevated)] border border-[var(--border-subtle)] rounded-2xl shadow-2xl max-w-md w-full overflow-hidden flex flex-col">
        <div className="p-4 flex justify-end">
          <button onClick={onComplete} className="text-[var(--text-tertiary)] hover:text-[var(--text-primary)] transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="px-8 pb-8 flex flex-col items-center text-center">
          <div className="mb-6 bg-amber-500/10 p-4 rounded-full">
            {steps[currentStep].icon}
          </div>

          <h2 className="text-2xl font-bold text-[var(--text-primary)] mb-4">
            {steps[currentStep].title}
          </h2>

          <p className="text-[var(--text-secondary)] leading-relaxed mb-8">
            {steps[currentStep].description}
          </p>

          <div className="flex gap-4 w-full">
            {currentStep > 0 && (
              <Button variant="ghost" onClick={prev} className="flex-1 border border-[var(--border-subtle)]">
                <ChevronLeft className="w-4 h-4 mr-2" />
                Back
              </Button>
            )}
            <Button onClick={next} className="flex-1 bg-amber-500 hover:bg-amber-600 text-black font-bold">
              {currentStep === steps.length - 1 ? "Get Started" : "Next"}
              {currentStep < steps.length - 1 && <ChevronRight className="w-4 h-4 ml-2" />}
            </Button>
          </div>

          <div className="flex gap-2 mt-8">
            {steps.map((_, i) => (
              <div
                key={i}
                className={`h-1 rounded-full transition-all duration-300 ${
                  i === currentStep ? "w-8 bg-amber-500" : "w-2 bg-[var(--border-subtle)]"
                }`}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
