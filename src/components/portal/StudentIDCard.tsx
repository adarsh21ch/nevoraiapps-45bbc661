import React from "react";
import { User, QrCode, Building2, Calendar } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatShortLocation } from "@/lib/location";

interface StudentIDCardProps {
  student: {
    name: string;
    player_id?: string | null;
    photo_url?: string | null;
    joined_at?: string | null;
    dob?: string | null;
    gender?: string | null;
    playing_role?: string | null;
    academy_name?: string;
    academy_logo?: string;
    phone?: string;
    session?: string;
    city?: string | null;
    state?: string | null;
    age_group?: string | null;
    sport?: string | null;
    batch_timing?: string | null;
    academy_phone?: string | null;
    village_locality?: string | null;
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

    const location = formatShortLocation(student.village_locality, student.city, student.state);

    if (side === "back") {
      return (
        <div className="p-4 bg-background flex items-center justify-center">
          <div
            ref={ref}
            className="w-[350px] h-[220px] bg-white text-slate-900 shadow-2xl rounded-2xl overflow-hidden relative border border-slate-200 flex flex-col"
            style={{ fontFamily: 'system-ui, -apple-system, sans-serif' }}
          >
            {/* Back Header */}
            <div className="h-[50px] px-5 flex items-center gap-3 bg-[#0f172a] text-white shrink-0">
              {student.academy_logo ? (
                <img src={student.academy_logo} alt="Logo" className="h-7 object-contain brightness-0 invert" />
              ) : (
                <Building2 className="size-5 text-amber-500" />
              )}
              <div className="font-black tracking-tight text-[13px] uppercase truncate">
                {student.academy_name || "AcademyOS"}
              </div>
            </div>

            {/* Back Body */}
            <div className="flex-1 flex gap-4 p-4 items-center">
                {/* Left: QR */}
                <div className="bg-white p-2 rounded-xl shadow-sm border border-slate-100">
                  <QrCode className="size-[80px] text-slate-900" />
                </div>
                
                {/* Right: Info */}
                <div className="flex-1 space-y-3">
                  <div>
                    <p className="text-[6px] font-bold text-slate-400 uppercase tracking-widest leading-none mb-0.5">Player ID</p>
                    <p className="text-[10px] font-black text-slate-900 leading-none">{student.player_id || "—"}</p>
                  </div>
                  <div>
                    <p className="text-[6px] font-bold text-slate-400 uppercase tracking-widest leading-none mb-0.5">Session / Batch</p>
                    <p className="text-[9px] font-black text-amber-600 leading-none truncate uppercase">{student.session || "General"}</p>
                  </div>
                  <div>
                    <p className="text-[6px] font-bold text-slate-400 uppercase tracking-widest leading-none mb-0.5">Training Time</p>
                    <p className="text-[9px] font-black text-slate-900 leading-none truncate uppercase">{student.batch_timing || "Regular"}</p>
                  </div>
                </div>
            </div>

            {/* Footer */}
            <div className="h-[30px] px-5 flex items-center justify-between border-t border-slate-100 shrink-0">
               <div className="text-[7px] font-bold text-slate-500 uppercase tracking-widest">
                  {student.academy_phone || "—"}
               </div>
               <div className="text-[7px] font-bold text-slate-300 uppercase tracking-widest">
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
          className="w-[350px] h-[220px] bg-white text-slate-900 shadow-2xl rounded-2xl overflow-hidden relative border border-slate-200 flex flex-col"
          style={{ fontFamily: 'system-ui, -apple-system, sans-serif' }}
        >
          {/* Header */}
          <div className="h-[60px] px-5 flex items-center justify-between bg-[#0f172a] text-white">
            <div className="flex items-center gap-3">
              {student.academy_logo ? (
                <img src={student.academy_logo} alt="Logo" className="h-8 object-contain brightness-0 invert" />
              ) : (
                <div className="size-8 bg-amber-500 rounded-lg flex items-center justify-center text-[10px] font-black italic text-slate-900">
                  {student.academy_name?.slice(0, 2).toUpperCase() || "AO"}
                </div>
              )}
              <div>
                <div className="font-black tracking-tight text-[12px] uppercase truncate leading-none mb-0.5 text-white">
                  {student.academy_name || "AcademyOS"}
                </div>
                <div className="text-[6px] uppercase tracking-[0.15em] font-bold text-white/60">
                  Player Identity Card
                </div>
              </div>
            </div>
            <div className="text-right">
              <p className="text-[6px] font-bold text-white/50 uppercase tracking-widest leading-none mb-0.5">Player ID</p>
              <p className="text-[12px] font-black text-amber-500 leading-none tracking-tighter">
                {student.player_id || "—"}
              </p>
            </div>
          </div>

          {/* Front Body */}
          <div className="flex-1 px-5 pt-4 pb-3 flex gap-5 bg-white">
            <div className="w-[80px] h-[105px] rounded-lg border border-slate-100 bg-slate-50 overflow-hidden flex items-center justify-center shadow-inner">
              {student.photo_url ? (
                <img src={student.photo_url} alt={student.name} className="size-full object-cover" />
              ) : (
                <User className="size-10 text-slate-300" />
              )}
            </div>

            <div className="flex-1 flex flex-col justify-center gap-3">
               <div>
                  <h2 className="text-[16px] font-black uppercase text-slate-900 leading-none truncate mb-1">
                    {student.name}
                  </h2>
               </div>

               <div className="grid grid-cols-2 gap-2">
                  <div>
                    <p className="text-[6px] font-bold text-slate-400 uppercase tracking-widest leading-none mb-0.5">Date of Birth</p>
                    <p className="text-[10px] font-black text-slate-800 leading-none">{formatDate(student.dob)}</p>
                  </div>
                  <div>
                    <p className="text-[6px] font-bold text-slate-400 uppercase tracking-widest leading-none mb-0.5">Sport</p>
                    <p className="text-[10px] font-black text-amber-600 leading-none uppercase">{student.sport || "Cricket"}</p>
                  </div>
               </div>
               
               {location && (
                 <div>
                   <p className="text-[6px] font-bold text-slate-400 uppercase tracking-widest leading-none mb-0.5">Location</p>
                   <p className="text-[10px] font-bold text-slate-800 leading-none truncate">{location.toUpperCase()}</p>
                 </div>
               )}
            </div>
          </div>

          {/* Footer */}
          <div className="px-5 py-2 flex justify-between items-center bg-slate-50 border-t border-slate-100">
             <div className="text-[7px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1">
                <Calendar className="size-2.5" />
                Member Since · {formatMemberSince(student.joined_at)}
             </div>
             <div className="text-[6px] font-black text-slate-400 uppercase tracking-[0.2em]">
                Official ID
             </div>
          </div>
        </div>
      </div>
    );
  }
);

StudentIDCard.displayName = "StudentIDCard";