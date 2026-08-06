import React from "react";
import { User, QrCode, Building2, MapPin, Phone } from "lucide-react";
import { cn } from "@/lib/utils";

interface StudentIDCardProps {
  student: {
    name: string;
    player_id?: string | null;
    photo_url?: string | null;
    joined_at?: string | null;
    dob?: string | null;
    sport?: string | null;
    academy_name?: string;
    academy_logo?: string;
    academy_address?: string | null;
    academy_phone?: string | null;
    phone?: string;
    session?: string;
    batch_timing?: string | null;
  };
  side?: "front" | "back";
}

export const StudentIDCard = React.forwardRef<HTMLDivElement, StudentIDCardProps>(
  ({ student, side = "front" }, ref) => {
    const formatDate = (dateStr?: string | null) => {
      if (!dateStr) return "—";
      try {
        const date = new Date(dateStr);
        return date.toLocaleDateString("en-IN", {
          day: "2-digit",
          month: "short",
          year: "numeric",
        }).toUpperCase();
      } catch {
        return "—";
      }
    };

    const formatMemberSince = (dateStr?: string | null) => {
      if (!dateStr) return "—";
      try {
        const date = new Date(dateStr);
        return date.toLocaleDateString("en-IN", {
          month: "short",
          year: "numeric",
        }).toUpperCase();
      } catch {
        return "—";
      }
    };

    const formatSession = (session?: string) => {
      if (!session) return "GENERAL SESSION";
      const s = session.toUpperCase();
      if (s.includes("BOTH SESSION")) return "MORNING + EVENING";
      return s;
    };

    // CR80 is 54mm x 86mm. 
    // For preview, we'll use a scale that looks good on screen.
    // Width 240px, Height 380px (~1.58 ratio)
    const cardWidth = 240;
    const cardHeight = 380;

    if (side === "back") {
      return (
        <div className="p-4 bg-background flex items-center justify-center">
          <div
            ref={ref}
            className="w-[240px] h-[380px] bg-white text-slate-900 shadow-2xl rounded-2xl overflow-hidden relative border border-slate-200 flex flex-col"
            style={{ fontFamily: 'system-ui, -apple-system, sans-serif' }}
          >
            {/* Back Header */}
            <div className="h-[70px] px-4 flex flex-col items-center justify-center bg-[#0f172a] text-white shrink-0 relative">
               <div className="flex items-center gap-2 mb-1">
                {student.academy_logo ? (
                  <img src={student.academy_logo} alt="Logo" className="h-8 object-contain brightness-0 invert" />
                ) : (
                  <Building2 className="size-5 text-white" />
                )}
              </div>
              <div className="font-black tracking-tight text-[11px] uppercase text-center leading-tight line-clamp-2">
                {student.academy_name || "AcademyOS"}
              </div>
              <div className="absolute bottom-0 left-0 right-0 h-4 bg-white" style={{ clipPath: "ellipse(60% 100% at 50% 100%)" }} />
            </div>

            {/* Back Body */}
            <div className="flex-1 flex flex-col items-center justify-center p-4 space-y-4">
                <div className="text-center">
                  <p className="text-[7px] font-bold text-slate-400 uppercase tracking-widest leading-none mb-1">Scan for Attendance</p>
                  <div className="bg-white p-2 rounded-xl shadow-sm border border-slate-100 mx-auto w-fit">
                    <QrCode className="size-[120px] text-slate-900" />
                  </div>
                </div>
                
                <div className="w-full text-center space-y-1">
                  <p className="text-[7px] font-bold text-slate-400 uppercase tracking-widest leading-none">Session / Batch</p>
                  <p className="text-[11px] font-black text-slate-900 leading-tight uppercase px-2">
                    {formatSession(student.session)}
                  </p>
                </div>
            </div>

            {/* Footer */}
            <div className="h-[40px] px-4 flex flex-col items-center justify-center bg-[#0f172a] shrink-0">
               <div className="text-[7px] font-bold text-white/40 uppercase tracking-[0.1em]">
                  Powered by Academy OS
               </div>
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className="p-4 bg-background flex items-center justify-center">
        <div
          ref={ref}
          className="w-[240px] h-[380px] bg-white text-slate-900 shadow-2xl rounded-2xl overflow-hidden relative border border-slate-200 flex flex-col"
          style={{ fontFamily: 'system-ui, -apple-system, sans-serif' }}
        >
          {/* Header */}
          <div className="h-[70px] px-4 flex flex-col items-center justify-center bg-[#0f172a] text-white shrink-0 relative">
            <div className="flex items-center gap-2 mb-1">
              {student.academy_logo ? (
                <img src={student.academy_logo} alt="Logo" className="h-8 object-contain brightness-0 invert" />
              ) : (
                <Building2 className="size-5 text-white" />
              )}
            </div>
            <div className="font-black tracking-tight text-[11px] uppercase text-center leading-tight line-clamp-2">
              {student.academy_name || "AcademyOS"}
            </div>
            <div className="absolute bottom-0 left-0 right-0 h-4 bg-white" style={{ clipPath: "ellipse(60% 100% at 50% 100%)" }} />
          </div>

          {/* Front Body */}
          <div className="flex-1 flex flex-col items-center px-4 pt-2">
            {/* Photo */}
            <div className="w-[85px] h-[105px] rounded-xl border-2 border-slate-100 bg-slate-50 overflow-hidden flex items-center justify-center shadow-md mb-3 shrink-0">
              {student.photo_url ? (
                <img src={student.photo_url} alt={student.name} className="size-full object-cover" />
              ) : (
                <User className="size-10 text-slate-200" />
              )}
            </div>

            {/* Name */}
            <h2 className="text-[15px] font-black uppercase text-slate-900 text-center leading-tight mb-4 px-1 line-clamp-2">
              {student.name}
            </h2>

            {/* Details */}
            <div className="w-full space-y-2.5 text-[9px]">
               <div className="flex items-start">
                 <span className="w-16 font-bold text-slate-400 uppercase tracking-tighter">Player ID</span>
                 <span className="font-black text-slate-900 ml-1">{student.player_id || "—"}</span>
               </div>
               <div className="flex items-start">
                 <span className="w-16 font-bold text-slate-400 uppercase tracking-tighter">Date of Birth</span>
                 <span className="font-black text-slate-900 ml-1">{formatDate(student.dob)}</span>
               </div>
               <div className="flex items-start">
                 <span className="w-16 font-bold text-slate-400 uppercase tracking-tighter">Sport</span>
                 <span className="font-black text-slate-900 ml-1 uppercase">{student.sport || "Cricket"}</span>
               </div>
               <div className="flex items-start">
                 <span className="w-16 font-bold text-slate-400 uppercase tracking-tighter">Contact</span>
                 <span className="font-black text-slate-900 ml-1">{student.phone || "—"}</span>
               </div>
               <div className="flex items-start">
                 <span className="w-16 font-bold text-slate-400 uppercase tracking-tighter">Address</span>
                 <span className="flex-1 font-bold text-slate-700 ml-1 leading-tight line-clamp-3">
                   {student.academy_address || "—"}
                 </span>
               </div>
            </div>
          </div>

          {/* Footer */}
          <div className="h-[45px] px-4 flex items-center justify-between bg-[#0f172a] text-white shrink-0">
             <div className="flex flex-col">
                <span className="text-[6px] font-bold text-white/50 uppercase tracking-widest">Member Since</span>
                <span className="text-[9px] font-black">{formatMemberSince(student.joined_at)}</span>
             </div>
             <div className="text-[8px] font-black uppercase tracking-wider text-white/80">
                Official ID Card
             </div>
          </div>
        </div>
      </div>
    );
  }
);

StudentIDCard.displayName = "StudentIDCard";