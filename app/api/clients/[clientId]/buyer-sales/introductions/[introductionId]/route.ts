import { NextResponse } from "next/server";
import { requireClientAccessFromRequest } from "@/lib/api-guards";
import { listBuyerIntroductions } from "@/lib/real-estate/buyer-introduction-service";
export const dynamic="force-dynamic";
export async function GET(req:Request,{params}:{params:{clientId:string;introductionId:string}}) {
 const g=await requireClientAccessFromRequest(req,params.clientId);if(g.error)return g.error;
 const result=await listBuyerIntroductions(params.clientId,{id:g.session.userId,name:g.session.user?.name??"Agent",role:g.session.role,clientId:g.session.clientId},params.introductionId);
 if(!result.ok)return NextResponse.json({error:result.error},{status:result.status});
 return result.items[0] ? NextResponse.json({introduction:result.items[0]},{headers:{"Cache-Control":"no-store"}}) : NextResponse.json({error:"Not found",code:"NOT_FOUND"},{status:404});
}
