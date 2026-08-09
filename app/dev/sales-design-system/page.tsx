import { notFound } from "next/navigation";
import { SalesDesignSystemClient } from "./SalesDesignSystemClient";

export default function SalesDesignSystemPage() {
  if (process.env.NODE_ENV === "production") {
    notFound();
  }
  return <SalesDesignSystemClient />;
}
