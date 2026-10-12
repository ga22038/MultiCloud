"use client";
import dynamic from "next/dynamic";
import { SessionGate } from "../frontend/SessionGate";
const App = dynamic(() => import("../frontend/App"), {
  ssr: false,
  loading: () => <SessionGate />,
});
export default function PolarisClient() {
  return <App />;
}
