import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ArrowDown, Shield, TrendingUp, Users } from "lucide-react";
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
    <div className="min-h-screen bg-background overflow-x-hidden">
      {/* Nav */}
      <nav className="fixed top-0 w-full z-50 backdrop-blur-xl bg-background/70 border-b border-border/50">
        <div className="max-w-6xl mx-auto flex items-center justify-between px-6 py-4">
          <img src={logo} alt="Silver Peak Health Plans" className="h-12" />
          <Button onClick={scrollToSurvey} size="sm" className="bg-accent text-accent-foreground hover:bg-accent/90 font-semibold">
            Get Appointed
          </Button>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative min-h-screen flex items-center justify-center pt-20">
        {/* Background effects */}
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[800px] h-[800px] rounded-full bg-primary/10 blur-[120px]" />
          <div className="absolute bottom-0 left-0 w-[400px] h-[400px] rounded-full bg-accent/5 blur-[100px]" />
        </div>

        <div className="relative z-10 max-w-4xl mx-auto px-6 text-center">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-primary/30 bg-primary/10 text-primary text-sm font-medium mb-8">
            <Shield className="w-4 h-4" />
            Licensed Agents & Brokers
          </div>

          <h1 className="text-5xl md:text-7xl font-bold tracking-tight leading-[1.1] mb-6">
            Elevate Your
            <span className="block bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
              Insurance Business
            </span>
          </h1>

          <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto mb-10 leading-relaxed">
            Partner with Silver Peak Health Plans and unlock competitive commissions,
            top-tier carrier access, and dedicated agent support — all in one place.
          </p>

          <Button
            onClick={scrollToSurvey}
            size="lg"
            className="h-14 px-10 text-lg font-bold bg-accent text-accent-foreground hover:bg-accent/90 shadow-lg hover:shadow-accent/25 transition-all duration-300 hover:scale-105"
          >
            Start Your Appointment
            <ArrowDown className="w-5 h-5 ml-2 animate-bounce" />
          </Button>

          {/* Trust signals */}
          <div className="mt-16 grid grid-cols-3 gap-8 max-w-lg mx-auto">
            {[
              { icon: Users, label: "500+ Agents" },
              { icon: TrendingUp, label: "Top Commissions" },
              { icon: Shield, label: "All Major Carriers" },
            ].map(({ icon: Icon, label }) => (
              <div key={label} className="flex flex-col items-center gap-2 text-muted-foreground">
                <Icon className="w-5 h-5 text-primary" />
                <span className="text-xs font-medium">{label}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Survey Section */}
      {showSurvey && (
        <section id="survey-section" className="py-20 px-6">
          <div className="max-w-4xl mx-auto">
            <h2 className="text-3xl md:text-4xl font-bold text-center mb-4">
              Appointment & Readiness Survey
            </h2>
            <p className="text-muted-foreground text-center mb-10 max-w-xl mx-auto">
              Complete the form below to get started with Silver Peak Health Plans.
            </p>
            <div className="rounded-xl border border-border bg-card overflow-hidden shadow-lg" style={{ boxShadow: "var(--shadow-glow)" }}>
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
      <footer className="border-t border-border/50 py-8 px-6 text-center text-sm text-muted-foreground">
        © {new Date().getFullYear()} Silver Peak Health Plans. All rights reserved.
      </footer>
    </div>
  );
};

export default Index;
