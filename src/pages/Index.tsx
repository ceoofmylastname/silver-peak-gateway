import { useState } from "react";
import { Button } from "@/components/ui/button";
import logo from "@/assets/silver-peak-logo.png";

const Index = () => {
  const [showSurvey, setShowSurvey] = useState(false);

  const scrollToSurvey = () => {
    setShowSurvey(true);
    setTimeout(() => {
      document.getElementById("survey-section")?.scrollIntoView({ behavior: "smooth" });
    }, 100);
  };

  return (
    <div className="min-h-screen bg-background overflow-x-hidden relative">
      {/* Nav */}
      <nav className="fixed top-0 w-full z-50 backdrop-blur-xl bg-background/80 border-b border-border/50">
        <div className="max-w-6xl mx-auto flex items-center justify-between px-6 py-4">
          <img src={logo} alt="Silver Peak Health Plans" className="h-12" />
          <Button
            onClick={scrollToSurvey}
            className="rounded-full bg-primary text-primary-foreground hover:bg-primary/90 font-bold px-6 tracking-wide"
          >
            CLAIM YOUR SPOT
          </Button>
        </div>
      </nav>

      {/* Floating 3D Shapes */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
        {/* Top-left rounded square */}
        <div className="absolute -top-10 -left-10 w-48 h-48 rounded-3xl bg-primary/8 backdrop-blur-sm border border-primary/10 rotate-12 shadow-xl" />
        {/* Top-right circle */}
        <div className="absolute top-20 -right-12 w-36 h-36 rounded-full bg-accent/10 backdrop-blur-sm border border-accent/15 shadow-lg" />
        {/* Mid-left circle */}
        <div className="absolute top-1/2 -left-16 w-40 h-40 rounded-full bg-primary/6 backdrop-blur-sm border border-primary/8 shadow-md" />
        {/* Mid-right rounded square */}
        <div className="absolute top-1/3 -right-8 w-32 h-32 rounded-2xl bg-accent/8 backdrop-blur-sm border border-accent/10 -rotate-12 shadow-lg" />
        {/* Bottom-left rounded square */}
        <div className="absolute bottom-32 left-8 w-28 h-28 rounded-2xl bg-primary/5 backdrop-blur-sm border border-primary/8 rotate-6 shadow-md" />
        {/* Bottom-right circle */}
        <div className="absolute bottom-20 right-20 w-24 h-24 rounded-full bg-accent/6 backdrop-blur-sm border border-accent/10 shadow-md" />
      </div>

      {/* Hero */}
      <section className="relative min-h-screen flex items-center justify-center pt-20 z-10">
        <div className="max-w-4xl mx-auto px-6 text-center">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 px-5 py-2 rounded-full border border-border bg-background text-muted-foreground text-xs font-semibold tracking-[0.2em] uppercase mb-8">
            BY INVITATION ONLY
          </div>

          <h1 className="text-5xl md:text-7xl lg:text-8xl font-bold tracking-tight leading-[1.05] mb-6 uppercase">
            <span className="text-foreground">STOP SELLING.</span>
            <br />
            <span className="bg-gradient-to-r from-accent to-accent/80 bg-clip-text text-transparent">START WINNING.</span>
          </h1>

          <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto mb-10 leading-relaxed" style={{ fontFamily: "'Playfair Display', serif", fontStyle: "italic" }}>
            The plan your clients have been waiting for — and the opportunity your competition will never see.
          </p>

          <Button
            onClick={scrollToSurvey}
            size="lg"
            className="h-14 px-10 text-lg font-bold rounded-full bg-accent text-accent-foreground hover:bg-accent/90 shadow-lg hover:shadow-accent/25 transition-all duration-300 hover:scale-105"
          >
            GET APPOINTED NOW
          </Button>
        </div>
      </section>

      {/* Bottom gradient */}
      <div className="fixed bottom-0 left-0 right-0 h-40 bg-gradient-to-t from-primary/10 via-primary/5 to-transparent pointer-events-none z-0" />

      {/* Survey Section */}
      {showSurvey && (
        <section id="survey-section" className="relative z-10 py-20 px-6">
          <div className="max-w-4xl mx-auto">
            <h2 className="text-3xl md:text-4xl font-bold text-center mb-4">
              Appointment & Readiness Survey
            </h2>
            <p className="text-muted-foreground text-center mb-10 max-w-xl mx-auto">
              Complete the form below to get started with Silver Peak Health Plans.
            </p>
            <div className="rounded-xl border border-border bg-card overflow-hidden shadow-lg">
              <iframe
                src="https://survey.alchemer.com/s3/7915428/Plan-Year-2025-Appoinment-and-Readiness-Session"
                width="100%"
                height="800"
                className="border-0"
                title="Appointment and Readiness Survey"
              />
            </div>
          </div>
        </section>
      )}

      {/* Footer */}
      <footer className="relative z-10 border-t border-border/50 py-8 px-6 text-center text-sm text-muted-foreground">
        © {new Date().getFullYear()} Silver Peak Health Plans. All rights reserved.
      </footer>
    </div>
  );
};

export default Index;
