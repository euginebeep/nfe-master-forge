import { motion } from "framer-motion";
import { Building2, Users, Package, FileText, Boxes, ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const modules = [
  {
    title: "Empresa",
    description: "Configuracoes fiscais e NF-e",
    icon: Building2,
    href: "/settings/company",
    color: "text-blue-500",
  },
  {
    title: "Entidades",
    description: "Fornecedores, clientes e parceiros",
    icon: Users,
    href: "/cadastros/entidades",
    color: "text-green-500",
  },
  {
    title: "Itens",
    description: "Materias primas e produtos",
    icon: Package,
    href: "/cadastros/itens",
    color: "text-purple-500",
  },
  {
    title: "Importar NF-e",
    description: "Upload de XML de notas fiscais",
    icon: FileText,
    href: "/compras/nfe-import",
    color: "text-orange-500",
  },
  {
    title: "Lotes",
    description: "Controle de estoque por lote",
    icon: Boxes,
    href: "/estoque/lotes",
    color: "text-teal-500",
  },
];

const Index = () => {
  return (
    <div className="space-y-8">
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center space-y-2"
      >
        <h1 className="text-3xl font-bold tracking-tight">LEGACY ERP</h1>
        <p className="text-muted-foreground">
          Sistema de gestao empresarial - Modulo 01: Cadastros Base
        </p>
      </motion.div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {modules.map((module, index) => (
          <motion.div
            key={module.href}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
          >
            <Link to={module.href}>
              <Card className="h-full hover:shadow-md transition-shadow cursor-pointer group">
                <CardHeader className="flex flex-row items-center gap-4">
                  <div className={`p-3 rounded-lg bg-muted ${module.color}`}>
                    <module.icon className="h-6 w-6" />
                  </div>
                  <div className="flex-1">
                    <CardTitle className="text-lg">{module.title}</CardTitle>
                  </div>
                  <ArrowRight className="h-5 w-5 text-muted-foreground group-hover:text-foreground transition-colors" />
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">{module.description}</p>
                </CardContent>
              </Card>
            </Link>
          </motion.div>
        ))}
      </div>
    </div>
  );
};

export default Index;
