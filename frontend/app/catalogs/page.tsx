import { Suspense } from "react";
import CatalogsClient from "./CatalogsClient";

export default function CatalogsPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-white flex items-center justify-center">
        <p className="text-xs tracking-[0.4em]">LOADING CATALOGS...</p>
      </div>
    }>
      <CatalogsClient />
    </Suspense>
  );
}