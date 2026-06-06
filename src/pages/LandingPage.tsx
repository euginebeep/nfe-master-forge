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
    <div className="min-h-screen bg-[#000000] text-white relative overflow-hidden font-sans selection:bg-[#10b981]/30">
      {/* Subtle Grid Background */}
      <div 
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage: `
            linear-gradient(rgba(255, 255, 255, 0.03) 1px, transparent 1px), 
            linear-gradient(90deg, rgba(255, 255, 255, 0.03) 1px, transparent 1px)
          `,
          backgroundSize: '60px 60px'
        }}
      />

      {/* Decorative Glows */}
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-blue-500/10 blur-[120px] rounded-full pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-[#10b981]/10 blur-[120px] rounded-full pointer-events-none" />

      <div className="max-w-7xl mx-auto px-6 py-12 relative z-10">
        {/* Header */}
        <header className="flex items-center justify-between mb-24">
          <div className="flex items-center gap-6">
            <img src={brainxLogo} alt="Logo" className="w-[84px] h-[84px] object-contain" />
            <div className="border-l border-white/10 pl-6">
              <h1 className="text-3xl font-extrabold tracking-tight text-white">Brainx Erp</h1>
              <p className="text-sm text-gray-400 font-medium mt-1">Gestão Industrial</p>
            </div>
          </div>
          
          <Link to="/auth">
            <Button variant="outline" className="bg-white/5 border-white/10 hover:bg-white/10 hover:border-white/20 text-white gap-2 h-11 px-6 rounded-xl transition-all">
              <LogIn className="w-4 h-4" />
              Acessar Plataforma
            </Button>
          </Link>
        </header>

        {/* Hero Section */}
        <div className="mb-32">
          <motion.h2 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, ease: "easeOut" }}
            className="text-6xl md:text-7xl font-bold max-w-4xl leading-[1.1] mb-10 tracking-tight"
          >
            BrainX ERP para gestão industrial de suplementos.
          </motion.h2>
          
          <motion.p 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.2, ease: "easeOut" }}
            className="text-2xl text-gray-400 max-w-2xl font-medium leading-relaxed"
          >
            Controle produção, estoque, qualidade e conformidade com rastreabilidade de ponta a ponta.
          </motion.p>
        </div>

        {/* Features Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {features.map((feature, index) => (
            <motion.div
              key={feature.title}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.1 * index }}
              className="group p-10 rounded-[32px] bg-[#ffffff03] border border-white/5 hover:border-[#10b981]/30 transition-all duration-500 hover:bg-[#ffffff06] backdrop-blur-sm shadow-2xl shadow-black/20"
            >
              <div className="w-14 h-14 rounded-2xl bg-[#10b981]/10 flex items-center justify-center mb-8 text-[#10b981] group-hover:scale-110 transition-transform duration-500">
                <feature.icon className="w-7 h-7" />
              </div>
              <h3 className="text-xl font-bold mb-4 group-hover:text-[#10b981] transition-colors duration-300">
                {feature.title}
              </h3>
              <p className="text-base text-gray-500 leading-relaxed group-hover:text-gray-400 transition-colors duration-300">
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