import type { Metadata } from "next";
import LearningLab from "../../learning/LearningLab";
export const metadata: Metadata = {
  title: "Aprender multicloud | Polaris UES",
  description:
    "Laboratorio del equipo: arquitectura, pruebas verificables y reproducción en cuentas propias.",
};
export default function LearningPage() {
  return <LearningLab />;
}
