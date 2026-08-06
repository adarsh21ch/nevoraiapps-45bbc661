import React from "react";
import { User, QrCode, Shield, Building2, MapPin, Calendar } from "lucide-react";
import { cn } from "@/lib/utils";

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
  };
  side?: "front" | "back";
}

export const StudentIDCard = React.forwardRef<HTMLDivElement, StudentIDCardProps>(
  ({ student, side = "front" }, ref) => {
    const brandColor = "#0f172a";
    const accentColor = "#f59e0b";

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

    const location = [student.city, student.state].filter(Boolean).join(", ");

    if (side === "back") {
      // PHASE 2 implementation will go here. 
      // For now, keeping the existing QR-focused design as the "back" logic.
      return (
        <div className="p-4 bg-background flex items-center justify-center">
          <div
            ref={ref}
            className="w-[350px] h-[220px] bg-slate-900 text-white shadow-2xl rounded-2xl overflow-hidden relative border border-slate-800 flex flex-col items-center justify-center"
            style={{ fontFamily: 'system-ui, -apple-system, sans-serif' }}
          >
            <div className="absolute top-4 left-5 flex items-center gap-2">
               <Shield className="size-4 text-primary" />
               <span className="text-[10px] font-black uppercase tracking-widest text-white/40">Academy Utility</span>
            </div>

            <div className="bg-white p-2 rounded-xl shadow-2xl">
              <QrCode className="size-24 text-slate-900" />
            </div>
            
            <div className="mt-4 text-center">
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-primary">Scan: In / Out</p>
              <p className="text-[8px] font-medium text-white/30 mt-1">Official Attendance QR</p>
            </div>

            <div className="absolute bottom-4 w-full px-6 flex justify-between items-center opacity-20">
               <div className="text-[8px] font-bold uppercase">{student.academy_name}</div>
               <div className="text-[8px] font-bold uppercase">ID: {student.player_id}</div>
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
          {/* Front Header */}
          <div className="h-[60px] px-5 flex items-center gap-3 bg-[#0f172a] text-white">
            {student.academy_logo ? (
              <img src={student.academy_logo} alt="Logo" className="h-9 object-contain brightness-0 invert" />
            ) : (
              <div className="size-9 bg-amber-500 rounded-lg flex items-center justify-center text-xs font-black italic text-slate-900">
                {student.academy_name?.slice(0, 2).toUpperCase() || "AO"}
              </div>
            )}
            <div className="flex-1 min-w-0">
              <div className="font-black tracking-tight text-sm uppercase truncate leading-tight">
                {student.academy_name || "AcademyOS"}
              </div>
              <div className="text-[8px] uppercase tracking-[0.2em] font-bold text-white/50">
                Player Identity Card
              </div>
            </div>
          </div>

          {/* Front Body */}
          <div className="flex-1 p-5 flex gap-5 relative">
            {/* Player Photo */}
            <div className="w-[85px] h-[110px] rounded-lg border-2 border-slate-100 bg-slate-50 overflow-hidden flex items-center justify-center shrink-0 shadow-sm">
              {student.photo_url ? (
                <img
                  src={student.photo_url}
                  alt={student.name}
                  className="size-full object-cover"
                />
              ) : (
                <div className="flex flex-col items-center gap-1">
                   <User className="size-10 text-slate-300" />
                   <span className="text-[14px] font-black text-slate-200">
                     {student.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0,2)}
                   </span>
                </div>
              )}
            </div>

            {/* Player Info */}
            <div className="flex-1 flex flex-col min-w-0">
               {/* Name - Strongest Hierarchy */}
               <div className="mb-3">
                  <h2 className={cn(
                    "font-black uppercase leading-[1.1] text-slate-900",
                    student.name.length > 20 ? "text-sm" : "text-base"
                  )}>
                    {student.name}
                  </h2>
               </div>

               <div className="grid grid-cols-2 gap-y-3 gap-x-2">
                  <div>
                    <p className="text-[7px] font-bold text-slate-400 uppercase tracking-widest">Player ID</p>
                    <p className="text-[11px] font-black text-amber-600 leading-tight">
                      {student.player_id || "—"}
                    </p>
                  </div>
                  <div>
                    <p className="text-[7px] font-bold text-slate-400 uppercase tracking-widest">DOB</p>
                    <p className="text-[10px] font-black text-slate-700 leading-tight">
                      {formatDate(student.dob)}
                    </p>
                  </div>
                  <div className="col-span-2">
                    <p className="text-[7px] font-bold text-slate-400 uppercase tracking-widest">Category</p>
                    <p className="text-[10px] font-black text-slate-700 leading-tight uppercase flex items-center gap-1">
                      {student.sport || "Cricket"} • {student.age_group || student.session || "Junior"}
                    </p>
                  </div>
                  {location && (
                    <div className="col-span-2">
                       <p className="text-[10px] font-bold text-slate-500 leading-tight flex items-center gap-1 truncate">
                          <MapPin className="size-2 text-slate-300" />
                          {location}
                       </p>
                    </div>
                  )}
               </div>
            </div>
          </div>

          {/* Member Since - Subtle Footer */}
          <div className="px-5 pb-3 flex justify-between items-center border-t border-slate-50 mt-auto">
             <div className="text-[8px] font-bold text-slate-300 uppercase tracking-widest flex items-center gap-1">
                <Calendar className="size-2" />
                Member Since · {formatMemberSince(student.joined_at)}
             </div>
             <div className="text-[6px] font-black text-slate-200 uppercase tracking-[0.3em]">
                Official ID
             </div>
          </div>
        </div>
      </div>
    );
  }
);

StudentIDCard.displayName = "StudentIDCard";