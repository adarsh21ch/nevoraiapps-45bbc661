import React from "react";
import { User, QrCode, Shield, Building2, MapPin, Calendar } from "lucide-react";
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

    const location = formatShortLocation(student.village_locality, student.city, student.state);

    if (side === "back") {
      return (
        <div className="p-4 bg-background flex items-center justify-center">
          <div
            ref={ref}
            className="w-[350px] h-[220px] bg-white text-slate-900 shadow-2xl rounded-2xl overflow-hidden relative border border-slate-200 flex flex-col"
            style={{ fontFamily: 'system-ui, -apple-system, sans-serif' }}
          >
            {/* Back Header - Compact branding */}
            <div className="h-[45px] px-5 flex items-center gap-2 bg-[#0f172a] text-white shrink-0">
              {student.academy_logo ? (
                <img src={student.academy_logo} alt="Logo" className="h-6 object-contain brightness-0 invert" />
              ) : (
                <Building2 className="size-4 text-amber-500" />
              )}
              <div className="font-black tracking-tight text-[11px] uppercase truncate">
                {student.academy_name || "AcademyOS"}
              </div>
            </div>

            {/* Back Body - Utility focused */}
            <div className="flex-1 flex flex-col items-center justify-center p-4">
               <div className="bg-white p-2 rounded-xl shadow-sm border border-slate-100 mb-2">
                  <QrCode className="size-[90px] text-slate-900" />
               </div>
               
               <p className="text-[9px] font-black uppercase tracking-[0.2em] text-amber-600 mb-4">
                 Scan for Attendance
               </p>

               <div className="w-full grid grid-cols-2 gap-x-4 gap-y-3 px-2">
                  <div>
                    <p className="text-[6px] font-bold text-slate-400 uppercase tracking-widest leading-none mb-1">Player ID</p>
                    <p className="text-[10px] font-black text-slate-700 leading-tight">
                      {student.player_id || "—"}
                    </p>
                  </div>
                  <div>
                    <p className="text-[6px] font-bold text-slate-400 uppercase tracking-widest leading-none mb-1">Academy Contact</p>
                    <p className="text-[10px] font-black text-slate-700 leading-tight">
                      {student.academy_phone || "—"}
                    </p>
                  </div>
                  <div>
                    <p className="text-[6px] font-bold text-slate-400 uppercase tracking-widest leading-none mb-1">Session / Batch</p>
                    <p className="text-[10px] font-black text-slate-700 leading-tight truncate uppercase">
                      {student.session || student.age_group || "General"}
                    </p>
                  </div>
                  <div>
                    <p className="text-[6px] font-bold text-slate-400 uppercase tracking-widest leading-none mb-1">Training Time</p>
                    <p className="text-[10px] font-black text-slate-700 leading-tight">
                      {student.batch_timing || "Regular"}
                    </p>
                  </div>
               </div>
            </div>

            {/* Footer - Subtle Branding */}
            <div className="h-[25px] px-5 flex items-center justify-center border-t border-slate-50 shrink-0">
               <div className="text-[6px] font-bold text-slate-300 uppercase tracking-widest">
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