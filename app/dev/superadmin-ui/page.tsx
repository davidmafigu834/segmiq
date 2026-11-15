import { notFound } from "next/navigation";
import { SuperadminUiStudio } from "./SuperadminUiStudio";

export default function SuperadminUiPage({ searchParams }: { searchParams?: { screen?: string } }) {
  if (process.env.NODE_ENV === "production") notFound();
  return <SuperadminUiStudio initialScreen={searchParams?.screen} />;
}
