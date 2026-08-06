import React from "react";
import { User, QrCode } from "lucide-react";

interface StudentIDCardProps {
  student: {
    name: string;
    player_id?: string | null;
    photo_url?: string | null;
    joined_at?: string | null;
    playing_role?: string | null;
    academy_name?: string;
    academy_logo?: string;
    phone?: string;
    session?: string;
  };
}

export const StudentIDCard = React.forwardRef<HTMLDivElement, StudentIDCardProps>(
  ({ student }, ref) => {
    return (
      <div className="p-4 bg-background overflow-hidden flex items-center justify-center">
        <div
          ref={ref}
          className="w-[350px] h-[220px] bg-[#0f172a] text-white shadow-2xl rounded-2xl overflow-hidden relative border border-slate-800"
          style={{ fontFamily: 'system-ui, -apple-system, sans-serif' }}
        >
          {/* Header */}
          <div className="px-5 pt-4 pb-2 flex items-center gap-3 border-b border-white/10">
            {student.academy_logo ? (
              <img src={student.academy_logo} alt="Logo" className="h-8 object-contain brightness-0 invert" />
            ) : (
              <div className="size-8 bg-primary rounded-lg flex items-center justify-center text-xs font-black italic">
                {student.academy_name?.slice(0, 2).toUpperCase() || "AO"}
              </div>
            )}
            <div className="flex-1 min-w-0">
              <div className="font-black tracking-tight text-xs uppercase truncate">
                {student.academy_name || "AcademyOS"}
              </div>
              <div className="text-[8px] uppercase tracking-[0.2em] font-bold text-white/50">
                Player Identity Card
              </div>
            </div>
          </div>

          {/* Body */}
          <div className="p-4 flex gap-4">
            {/* Photo */}
            <div className="size-24 rounded-xl border-2 border-primary bg-slate-800 overflow-hidden flex items-center justify-center shrink-0">
              {student.photo_url ? (
                <img
                  src={student.photo_url}
                  alt={student.name}
                  className="size-full object-cover"
                />
              ) : (
                <User className="size-12 text-slate-700" />
              )}
            </div>

            {/* Info */}
            <div className="flex-1 space-y-2 min-w-0">
              <div>
                <p className="text-[7px] font-bold text-white/40 uppercase tracking-widest">Player</p>
                <h2 className="text-sm font-black uppercase truncate leading-tight">
                  {student.name}
                </h2>
              </div>
              
              <div className="flex gap-4">
                <div>
                  <p className="text-[7px] font-bold text-white/40 uppercase tracking-widest">ID</p>
                  <p className="text-[11px] font-black text-primary leading-tight">
                    {student.player_id || "—"}
                  </p>
                </div>
                <div>
                  <p className="text-[7px] font-bold text-white/40 uppercase tracking-widest">Session</p>
                  <p className="text-[10px] font-bold leading-tight truncate max-w-[80px]">
                    {student.session || student.playing_role || "—"}
                  </p>
                </div>
              </div>

              <div>
                <p className="text-[7px] font-bold text-white/40 uppercase tracking-widest">Contact</p>
                <p className="text-[10px] font-bold leading-tight">
                  {student.phone || "—"}
                </p>
              </div>
            </div>
          </div>

          {/* QR Overlay (Centered Bottom) */}
          <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex flex-col items-center">
             <div className="bg-white p-1 rounded-md shadow-lg">
                <QrCode className="size-10 text-slate-900" />
             </div>
             <p className="text-[6px] font-black uppercase tracking-tighter text-white/30 mt-1">
               Scan: In / Out
             </p>
          </div>

          {/* Footer Dates */}
          <div className="absolute bottom-3 left-4">
            <p className="text-[7px] font-bold text-white/30 uppercase tracking-widest">
              Joined {student.joined_at ? new Date(student.joined_at).getFullYear() : "—"}
            </p>
          </div>
        </div>
      </div>
    );
  }
);

StudentIDCard.displayName = "StudentIDCard";