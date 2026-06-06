import { motion } from "framer-motion";
import { 
  Activity, ShieldCheck, Layers, Receipt, 
  Thermometer, Beaker, ArrowRight, LogIn
} from "lucide-react";
import { Link } from "react-router-dom";
import brainxLogo from "@/assets/brainx-logo.png";
import { Button } from "@/components/ui/button";

const features = [
  {
    title: "Produção rastreável",
    description: "Ordens, lotes e etapas críticas em um fluxo industrial único.",
    icon: Activity,
  },
  {
    title: "Qualidade e BPF",
    description: "Controles técnicos para suplementos, auditoria e liberação segura.",
    icon: ShieldCheck,
  },
  {
    title: "Estoque por lote",
    description: "FEFO, quarentena, COA e consumo com rastreabilidade total.",
    icon: Layers,
  },
  {
    title: "Emissão de NF-e / NFC-e",
    description: "Emissor fiscal integrado com cálculo automático de impostos e DANFE.",
    icon: Receipt,
  },
  {
    title: "Controle de temperatura",
    description: "Monitoramento por sensores IoT com alertas e histórico para BPF.",
    icon: Thermometer,
  },
  {
    title: "Formulador industrial",
    description: "Cápsulas, líquidos e pós com potência por lote e travas de segurança.",
    icon: Beaker,
  },
];

const LandingPage = () => {
  return (
    <div className="min-h-screen bg-[#0d1b2a] text-white relative overflow-hidden font-sans">
      {/* Subtle Grid Background */}
      <div 
        className="absolute inset-0 pointer-events-none opacity-20"
        style={{
          backgroundImage: `
            linear-gradient(rgba(255, 255, 255, 0.05) 1px, transparent 1px), 
            linear-gradient(90deg, rgba(255, 255, 255, 0.05) 1px, transparent 1px)
          `,
          backgroundSize: '40px 40px'
        }}
      />

      <div className="max-w-7xl mx-auto px-6 py-12 relative z-10">
        {/* Header */}
        <header className="flex items-center justify-between mb-24">
          <div className="flex items-center gap-4">
            <img src={brainxLogo} alt="Logo" className="w-16 h-16 object-contain" />
            <div>
              <h1 className="text-xl font-bold tracking-tight">BRAINX ERP</h1>
              <p className="text-xs text-gray-400 font-medium">Plataforma industrial regulatória</p>
            </div>
          </div>
          
          <Link to="/auth">
            <Button variant="outline" className="bg-white/5 border-white/10 hover:bg-white/10 text-white gap-2">
              <LogIn className="w-4 h-4" />
              Acessar Plataforma
            </Button>
          </Link>
        </header>

        {/* Hero Section */}
        <div className="mb-24">
          <motion.h2 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="text-5xl md:text-6xl font-bold max-w-3xl leading-tight mb-8"
          >
            BrainX ERP para gestão industrial de suplementos.
          </motion.h2>
          
          <motion.p 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="text-xl text-gray-400 max-w-2xl"
          >
            Controle produção, estoque, qualidade e conformidade com rastreabilidade de ponta a ponta.
          </motion.p>
        </div>

        {/* Features Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map((feature, index) => (
            <motion.div
              key={feature.title}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.1 * index }}
              className="group p-8 rounded-2xl bg-white/5 border border-white/10 hover:border-[#10b981]/50 transition-all hover:bg-white/10"
            >
              <div className="w-12 h-12 rounded-xl bg-[#10b981]/10 flex items-center justify-center mb-6 text-[#10b981]">
                <feature.icon className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold mb-3 group-hover:text-[#10b981] transition-colors">
                {feature.title}
              </h3>
              <p className="text-sm text-gray-400 leading-relaxed">
                {feature.description}
              </p>
            </motion.div>
          ))}
        </div>

        {/* Footer CTA */}
        <div className="mt-24 text-center">
          <Link to="/auth">
            <Button size="lg" className="bg-[#10b981] hover:bg-[#059669] text-white px-8 py-6 rounded-full text-lg font-bold gap-3 group">
              Começar Agora
              <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
};

export default LandingPage;