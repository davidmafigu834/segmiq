import { notFound } from "next/navigation";
import { SolarUiStudio } from "./SolarUiStudio";

export default function SolarUiPage({ searchParams }: { searchParams?: { screen?: string } }) {
  if (process.env.NODE_ENV === "production") notFound();
  return <SolarUiStudio initialScreen={searchParams?.screen} />;
}
