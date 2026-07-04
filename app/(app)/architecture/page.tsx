"use client";

import { motion } from "framer-motion";
import { User, MessageSquare, Shield, Search, Calculator, ShieldCheck, FileText, CheckCircle, ArrowDown } from "lucide-react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

const STAGES = [
  {
    id: "user",
    title: "User Input",
    icon: User,
    color: "text-blue-500",
    bg: "bg-blue-500/10",
    border: "border-blue-500/20",
    glow: "hover:shadow-[0_0_15px_rgba(59,130,246,0.3)]",
    description: "The pipeline begins when a human user submits a standard prompt to the AI agent. At this stage, the request is completely benign and untainted.",
  },
  {
    id: "chat",
    title: "AI Chat Interface (MCP Client)",
    icon: MessageSquare,
    color: "text-indigo-500",
    bg: "bg-indigo-500/10",
    border: "border-indigo-500/20",
    glow: "hover:shadow-[0_0_15px_rgba(99,102,241,0.3)]",
    description: "The AI agent processes the user's intent. Determining it needs external data, it constructs a tool-call request via the Model Context Protocol to fetch external context.",
  },
  {
    id: "agentshield",
    title: "Aegis Middleware",
    icon: Shield,
    color: "text-purple-500",
    bg: "bg-purple-500/10",
    border: "border-purple-500/20",
    glow: "hover:shadow-[0_0_15px_rgba(168,85,247,0.3)]",
    description: "Before the tool's response is returned to the AI's context window, Aegis intercepts the payload. It acts as a zero-trust proxy between the external world and the LLM.",
  },
  {
    id: "engine",
    title: "Threat Detection Engine",
    icon: null, // Custom rendering for the split stage
    color: "text-orange-500",
    bg: "bg-orange-500/10",
    border: "border-orange-500/20",
    glow: "hover:shadow-[0_0_15px_rgba(249,115,22,0.3)]",
    description: "The core intelligence of Aegis. The Prompt Scanner runs highly optimized multi-vector regex rules to find malicious payloads, while the Risk Engine calculates an aggregate threat score with diminishing returns.",
  },
  {
    id: "sanitization",
    title: "Sanitization Engine",
    icon: ShieldCheck,
    color: "text-emerald-500",
    bg: "bg-emerald-500/10",
    border: "border-emerald-500/20",
    glow: "hover:shadow-[0_0_15px_rgba(16,185,129,0.3)]",
    description: "Instead of simply blocking the response and breaking the AI's workflow, the Sanitizer precisely excises the malicious substring, replacing it with a secure redaction token.",
  },
  {
    id: "report",
    title: "Threat Telemetry",
    icon: FileText,
    color: "text-yellow-500",
    bg: "bg-yellow-500/10",
    border: "border-yellow-500/20",
    glow: "hover:shadow-[0_0_15px_rgba(234,179,8,0.3)]",
    description: "The intercepted threat metadata (original content, risk score, and matched patterns) is asynchronously logged to the SQLite database for the Analytics and Logs dashboard.",
  },
  {
    id: "safe-response",
    title: "Safe AI Response",
    icon: CheckCircle,
    color: "text-primary",
    bg: "bg-primary/10",
    border: "border-primary/20",
    glow: "hover:shadow-[0_0_15px_var(--primary)]",
    description: "The AI agent safely receives the sanitized context. Completely unaware of the averted injection attempt, it fulfills the original user's request securely.",
  },
];

export default function ArchitecturePage() {
  const containerVariants = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: { staggerChildren: 0.2 }
    }
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    show: { opacity: 1, y: 0 }
  };

  return (
    <div className="p-8 max-w-4xl mx-auto space-y-8 pb-20">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">System Architecture</h1>
        <p className="text-muted-foreground mt-1">
          Explore the lifecycle of an MCP tool call intercepted and secured by Aegis.
        </p>
      </div>

      <motion.div 
        variants={containerVariants}
        initial="hidden"
        animate="show"
        className="flex flex-col items-center max-w-2xl mx-auto relative mt-12"
      >
        {/* Animated Background Line */}
        <div className="absolute top-0 bottom-0 left-1/2 w-0.5 bg-border -translate-x-1/2 z-0" />
        
        {/* Traveling Dot Animation */}
        <motion.div 
          className="absolute top-0 left-1/2 w-3 h-3 rounded-full bg-primary -translate-x-1/2 z-10 shadow-[0_0_10px_var(--primary)]"
          animate={{ top: ["0%", "100%"] }}
          transition={{ duration: 4, repeat: Infinity, ease: "linear" }}
        />

        {STAGES.map((stage, index) => (
          <motion.div 
            key={stage.id}
            variants={itemVariants}
            className="w-full relative z-20 mb-8 last:mb-0"
          >
            {/* The Box */}
            <div className={`
              bg-card border ${stage.border} rounded-xl overflow-hidden transition-shadow duration-300 ${stage.glow}
            `}>
              <Accordion className="w-full">
                <AccordionItem value={stage.id} className="border-none">
                  
                  {/* Custom rendering for the split Detection Engine */}
                  {stage.id === "engine" ? (
                    <AccordionTrigger className="px-6 py-4 hover:no-underline hover:bg-secondary/20 transition-colors">
                      <div className="flex w-full items-center justify-between gap-4">
                        
                        <div className="flex-1 flex flex-col items-center justify-center p-4 border border-orange-500/20 bg-orange-500/5 rounded-lg">
                          <Search className="w-6 h-6 text-orange-500 mb-2" />
                          <span className="font-semibold text-sm">Prompt Scanner</span>
                        </div>
                        
                        <div className="w-4 h-0.5 bg-border shrink-0" />
                        
                        <div className="flex-1 flex flex-col items-center justify-center p-4 border border-red-500/20 bg-red-500/5 rounded-lg">
                          <Calculator className="w-6 h-6 text-red-500 mb-2" />
                          <span className="font-semibold text-sm">Risk Engine</span>
                        </div>

                      </div>
                    </AccordionTrigger>
                  ) : (
                    <AccordionTrigger className="px-6 py-4 hover:no-underline hover:bg-secondary/20 transition-colors">
                      <div className="flex items-center gap-4 text-left">
                        <div className={`p-3 rounded-lg ${stage.bg}`}>
                          {stage.icon && <stage.icon className={`w-6 h-6 ${stage.color}`} />}
                        </div>
                        <span className="font-semibold text-lg">{stage.title}</span>
                      </div>
                    </AccordionTrigger>
                  )}

                  <AccordionContent className="px-6 pb-4 text-muted-foreground leading-relaxed">
                    {stage.description}
                  </AccordionContent>
                </AccordionItem>
              </Accordion>
            </div>

            {/* Connecting Arrow for all except last */}
            {index < STAGES.length - 1 && (
              <div className="flex justify-center my-2 h-6">
                <ArrowDown className="w-5 h-5 text-muted-foreground/50 animate-pulse" />
              </div>
            )}
          </motion.div>
        ))}
      </motion.div>
    </div>
  );
}
