import { planDateInTimezone } from "@/lib/sales/intelligence/timezone";
import { NextResponse } from "next/server";
import { requireSalesActorFromRequest } from "@/lib/api-guards";
import { createAdminClient } from "@/lib/supabase/admin";
import { fetchSalespersonTasks } from "@/lib/sales/tasks/sales-tasks-data";
import { resolveClientSalesTimezone } from "@/lib/sales/intelligence/daily-plan-service";
import { GET as readViewings } from "@/app/api/clients/[clientId]/viewings/route";
import { calendarWindow,uniqueCalendarEvents,type MobileCalendarEvent } from "@/lib/real-estate/mobile-calendar";
export const dynamic="force-dynamic";
export async function GET(req:Request) {
 const g=await requireSalesActorFromRequest(req);if(g.error)return g.error;
 const session=g.session;if(!session?.clientId)return NextResponse.json({error:"Organisation required"},{status:403});
 const url=new URL(req.url),range=calendarWindow(url.searchParams.get("from"),url.searchParams.get("to"));
 const page=Number(url.searchParams.get("page")??1),limit=Number(url.searchParams.get("limit")??100);
 if(!range||!Number.isSafeInteger(page)||page<1||!Number.isSafeInteger(limit)||limit<1||limit>500)return NextResponse.json({error:"Use a valid from/to interval up to 93 days and positive page/limit",code:"INVALID_REQUEST"},{status:400});
 try {
  const timezone=await resolveClientSalesTimezone(session.clientId);
  const [tasks,dates]=await Promise.all([fetchSalespersonTasks({userId:session.userId,clientId:session.clientId,view:"mine"}),createAdminClient().from("leads").select("id,follow_up_date").eq("client_id",session.clientId).eq("assigned_to_id",session.userId)]);
  if(dates.error)throw new Error("Calendar source unavailable");
  const dateByLead=new Map((dates.data??[]).map(r=>[r.id,r.follow_up_date]));
  const events:MobileCalendarEvent[]=[];
  for(const t of [...tasks.tasks,...tasks.upcoming]) {
   if(t.completed||t.assignedToId!==session.userId||!t.dueAt)continue;
   const raw=dateByLead.get(t.leadId),dateOnly=typeof raw==="string"&&/^\d{4}-\d{2}-\d{2}$/.test(raw)&&t.type!=="call"&&t.id.startsWith("followup-");
   const key=dateOnly?raw:t.dueAt;
   if(dateOnly ? key<planDateInTimezone(new Date(range.from),timezone)||key>=planDateInTimezone(new Date(range.to),timezone) : Date.parse(key)<Date.parse(range.from)||Date.parse(key)>=Date.parse(range.to))continue;
   events.push({id:`task:${t.id}`,type:t.type,startAt:dateOnly?null:t.dueAt,endAt:null,allDay:dateOnly,date:dateOnly?raw:null,timezone,relatedEntity:{type:"lead",id:t.leadId},title:t.title,permittedActions:[]});
  }
  const vurl=new URL(req.url);vurl.search="";vurl.searchParams.set("from",range.from);vurl.searchParams.set("to",range.to);vurl.searchParams.set("limit","500");
  const response=await readViewings(new Request(vurl,{headers:req.headers}),{params:{clientId:session.clientId}});if(!response.ok)return response;
  const viewings=await response.json();
  for(const v of viewings.viewings??[]){if(Date.parse(v.scheduled_at)>=Date.parse(range.to))continue;events.push({id:`viewing:${v.id}`,type:"viewing",startAt:v.scheduled_at,endAt:null,allDay:false,date:null,timezone,relatedEntity:{type:"viewing",id:v.id},title:"Property viewing",permittedActions:[]});}
  const unique=uniqueCalendarEvents(events);
  return NextResponse.json({events:unique.slice((page-1)*limit,page*limit),timezone,page,limit,total:unique.length,incomplete:true,completenessReason:"Underlying tasks and callback sources retain existing server caps",viewingsIncomplete:Boolean(viewings.incomplete)||viewings.total>500,sourceCoverage:["FOLLOW_UP","CALL","QUOTE_REVIEW","VIEWING"],standaloneMeetingsSupported:false},{headers:{"Cache-Control":"no-store"}});
 }catch{return NextResponse.json({error:"Calendar unavailable",code:"SERVICE_UNAVAILABLE"},{status:503});}
}
