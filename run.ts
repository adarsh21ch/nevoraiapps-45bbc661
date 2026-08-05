import jsPDF from "jspdf";
import * as mod from "./card.ts";
const t:any={name:"Sai Sports Academy",short_name:"Sai Sports",primary_color:"#0b5cab",secondary_color:"#f59e0b",phone:"+91 98765 43210",slug:"sai"};
const r:any={playerId:"SAI0042",name:"Mohit Kumar Sharma",guardianName:"Ramesh Sharma",dob:"2010-04-12",phone:"+91 90000 11111",guardianPhone:"+91 90000 22222",batchName:"Morning Session",joinedAt:"2026-01-10",photoPath:null,cardToken:"abc-123"};
const orig=(globalThis as any).Blob;
// patch save
const jsp:any=jsPDF;
jsp.prototype.save=function(name:string){ const ab=this.output("arraybuffer"); require("fs").writeFileSync("/tmp/qa/out.pdf", Buffer.from(ab)); };
await mod.generateIdCardPdf(t,r);
console.log("ok");
