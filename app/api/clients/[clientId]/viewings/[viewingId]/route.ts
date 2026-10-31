import { NextResponse } from "next/server";
import { GET as readViewings } from "../route";
export const dynamic = "force-dynamic";
export async function GET(req: Request, {params}:{params:{clientId:string;viewingId:string}}) {
 const url=new URL(req.url);url.search="";url.searchParams.set("id",params.viewingId);
 const response=await readViewings(new Request(url,{headers:req.headers}),{params:{clientId:params.clientId}});
 if(!response.ok)return response;
 const body=await response.json();
 return body.viewings?.[0] ? NextResponse.json({viewing:body.viewings[0],timezone:body.timezone},{headers:{"Cache-Control":"no-store"}}) : NextResponse.json({error:"Not found",code:"NOT_FOUND"},{status:404});
}
