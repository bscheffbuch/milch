"use client";

export default function PrintButton({ children = "Drucken" }: { children?: string }) {
  return (
    <button className="btn-quiet no-print" type="button" onClick={() => window.print()}>
      {children}
    </button>
  );
}
