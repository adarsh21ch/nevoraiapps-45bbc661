import React from "react";
import { Card } from "@/components/ui/card";
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
  };
}

export const StudentIDCard = React.forwardRef<HTMLDivElement, StudentIDCardProps>(
  ({ student }, ref) => {
    return (
      <div className="p-4 bg-background overflow-hidden flex items-center justify-center">
        <div
          ref={ref}
          className="w-[350px] h-[520px] bg-white text-slate-900 shadow-2xl rounded-2xl overflow-hidden relative border border-slate-200"
          style={{ fontFamily: 'system-ui, -apple-system, sans-serif' }}
        >
          {/* Header/Academy Branding */}
          <div className="h-28 bg-primary p-6 flex flex-col items-center justify-center text-primary-foreground relative">
            <div className="absolute top-0 right-0 p-2 opacity-10">
               <QrCode className="size-16" />
            </div>
            {student.academy_logo ? (
              <img src={student.academy_logo} alt="Logo" className="h-10 mb-1 object-contain brightness-0 invert" />
            ) : (
              <div className="font-bold tracking-tight text-lg uppercase italic">
                {student.academy_name || "AcademyOS"}
              </div>
            )}
            <div className="text-[10px] uppercase tracking-[0.2em] font-medium opacity-80">
              Official Identity Card
            </div>
          </div>

          {/* Photo Section */}
          <div className="flex justify-center -mt-12 mb-4 relative z-10">
            <div className="size-32 rounded-2xl border-4 border-white bg-slate-100 shadow-lg overflow-hidden flex items-center justify-center">
              {student.photo_url ? (
                <img
                  src={student.photo_url}
                  alt={student.name}
                  className="size-full object-cover"
                />
              ) : (
                <User className="size-16 text-slate-300" />
              )}
            </div>
          </div>

          {/* Info Section */}
          <div className="px-8 text-center space-y-4">
            <div>
              <h2 className="text-xl font-bold text-slate-900 uppercase tracking-tight">
                {student.name}
              </h2>
              <div className="inline-block px-3 py-1 bg-primary/10 text-primary text-[10px] font-bold uppercase tracking-widest rounded-full mt-1">
                {student.playing_role || "Student"}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 text-left pt-2 border-t border-slate-100">
              <div className="space-y-0.5">
                <p className="text-[9px] uppercase font-bold text-slate-400 tracking-wider">Member ID</p>
                <p className="text-sm font-semibold text-slate-700">{student.player_id || "N/A"}</p>
              </div>
              <div className="space-y-0.5">
                <p className="text-[9px] uppercase font-bold text-slate-400 tracking-wider">Joined Since</p>
                <p className="text-sm font-semibold text-slate-700">
                  {student.joined_at ? new Date(student.joined_at).getFullYear() : "N/A"}
                </p>
              </div>
            </div>

            <div className="pt-4 flex justify-center opacity-20">
               <QrCode className="size-20" />
            </div>
          </div>

          {/* Footer Decoration */}
          <div className="absolute bottom-0 left-0 right-0 h-2 bg-primary" />
          <div className="absolute bottom-4 left-0 right-0 text-center">
             <p className="text-[8px] uppercase font-bold text-slate-300 tracking-[0.3em]">
               AcademyOS Platform
             </p>
          </div>
        </div>
      </div>
    );
  }
);

StudentIDCard.displayName = "StudentIDCard";
