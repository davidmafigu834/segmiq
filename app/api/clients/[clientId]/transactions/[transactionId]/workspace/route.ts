import { NextResponse } from "next/server";
import { requireClientAccessFromRequest } from "@/lib/api-guards";
import { transactionOperations } from "@/lib/real-estate/agency-service";
import { transactionMobileDto } from "@/lib/real-estate/mobile-contract";
export const dynamic="force-dynamic";
export async function GET(req:Request,{params}:{params:{clientId:string;transactionId:string}}) {
 const g=await requireClientAccessFromRequest(req,params.clientId);if(g.error)return g.error;
 const result=await transactionOperations(params.clientId,{id:g.session.userId,name:g.session.user?.name??"Agent",role:g.session.role,clientId:g.session.clientId},params.transactionId);
 if(!result.ok)return NextResponse.json({error:result.error},{status:result.status});
 return NextResponse.json(transactionMobileDto(result,g.session.role),{headers:{"Cache-Control":"no-store"}});
}
