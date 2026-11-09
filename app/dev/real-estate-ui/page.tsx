import { notFound } from "next/navigation";
import { RealEstateUiStudio } from "./RealEstateUiStudio";

export default function RealEstateUiPage({ searchParams }: { searchParams?: { screen?: string } }) {
  if (process.env.NODE_ENV === "production") notFound();
  return <RealEstateUiStudio initialScreen={searchParams?.screen} />;
}
