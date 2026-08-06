import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Pencil, Save, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { INDIAN_STATES } from "@/lib/location";

interface EditMyProfileDialogProps {
  student: any;
  onSaved: () => void;
}

export function EditMyProfileDialog({ student, onSaved }: EditMyProfileDialogProps) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [f, setF] = useState({
    name: student.name || "",
    guardian_name: student.guardian_name || "",
    village_locality: student.village_locality || "",
    city: student.city || "",
    state: student.state || "",
    current_address: student.current_address || "",
    permanent_address: student.permanent_address || student.address || "",
  });

  const handleSave = async () => {
    setSaving(true);
    try {
      const { error } = await supabase
        .from("students")
        .update({
          name: f.name,
          guardian_name: f.guardian_name,
          village_locality: f.village_locality,
          city: f.city,
          state: f.state,
          current_address: f.current_address,
          permanent_address: f.permanent_address,
          // Legacy field sync
          address: f.permanent_address || f.current_address,
        })
        .eq("id", student.id);

      if (error) throw error;
      toast.success("Profile updated");
      onSaved();
      setOpen(false);
    } catch (err: any) {
      toast.error(err.message || "Failed to update profile");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm" className="h-7 text-[10px] px-2 font-bold uppercase tracking-wider bg-muted/50 hover:bg-muted">
          <Pencil className="size-3 mr-1" /> Edit Profile
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Edit Profile</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label>Full Name</Label>
            <Input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
          </div>
          <div className="space-y-2">
            <Label>Guardian Name</Label>
            <Input value={f.guardian_name} onChange={(e) => setF({ ...f, guardian_name: e.target.value })} />
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Village / Locality</Label>
              <Input value={f.village_locality} onChange={(e) => setF({ ...f, village_locality: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>City / District</Label>
              <Input value={f.city} onChange={(e) => setF({ ...f, city: e.target.value })} />
            </div>
          </div>

          <div className="space-y-2">
            <Label>State</Label>
            <Select value={f.state} onValueChange={(v) => setF({ ...f, state: v })}>
              <SelectTrigger>
                <SelectValue placeholder="Select State" />
              </SelectTrigger>
              <SelectContent>
                {INDIAN_STATES.map((s) => (
                  <SelectItem key={s} value={s}>{s}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Current Address</Label>
            <Textarea 
              value={f.current_address} 
              onChange={(e) => setF({ ...f, current_address: e.target.value })} 
              rows={2}
            />
          </div>

          <div className="space-y-2">
            <Label>Permanent Address</Label>
            <Textarea 
              value={f.permanent_address} 
              onChange={(e) => setF({ ...f, permanent_address: e.target.value })} 
              rows={2}
            />
          </div>

          <Button 
            className="w-full h-11" 
            onClick={handleSave} 
            disabled={saving}
          >
            {saving ? <Loader2 className="size-4 animate-spin mr-2" /> : <Save className="size-4 mr-2" />}
            Save Changes
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
