import { Suspense } from "react";
import CatalogsClient from "./CatalogsClient";

export default function CatalogsPage() {
  return (
    <Suspense fallback={<div className="p-6">Loading catalogs…</div>}>
      <CatalogsClient />
    </Suspense>
  );
}
