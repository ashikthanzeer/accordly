import React from "react";
import Link from "next/link";

export default function NotFound() {
  return (
    <div className="min-h-screen bg-[#090A0C] text-[#F5F3ED] flex items-center justify-center p-6">
      <div className="bg-[#171A20] border border-[#292D35] rounded-2xl p-8 max-w-md w-full text-center space-y-4 shadow-xl">
        <div className="w-12 h-12 mx-auto rounded-full bg-[#D4AF65]/15 text-[#D4AF65] flex items-center justify-center text-xl font-bold border border-[#D4AF65]/30">
          404
        </div>
        <h2 className="text-lg font-bold text-[#F5F3ED]">Page Not Found</h2>
        <p className="text-xs text-[#9298A3] leading-relaxed">
          The requested resource or page could not be found.
        </p>
        <div className="pt-2">
          <Link
            href="/"
            className="inline-flex items-center px-4 py-2 rounded-lg text-xs font-bold text-[#090A0C] bg-[#D4AF65] hover:bg-[#E2C17F] transition-colors shadow-sm"
          >
            Return to Dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}

