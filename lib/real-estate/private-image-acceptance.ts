import { z } from "zod";
export const PRIVATE_IMAGE_ACCEPTANCE_CHECKS = [
 "two_agent_listing_privacy", "cross_tenant_listing_denial", "revoked_session_denial",
 "private_bucket_policy", "object_tenant_property_ownership", "signed_url_expiry",
 "mime_size_validation", "no_public_fallback", "no_document_exposure", "host_redirect_policy",
] as const;
const packetSchema = z.object({
 schemaVersion:z.literal(1), backendOrigin:z.string().url(), deployedRevision:z.string().regex(/^[a-f0-9]{40}$/),
 contractVersion:z.literal(1), operation:z.literal("property_images.sign"), result:z.literal("APPROVED"),
 evidenceEnvironment:z.literal("DEPLOYED_SYNTHETIC"), reviewedBy:z.string().min(1),
 verifiedAt:z.string().datetime({offset:true}), expiresAt:z.string().datetime({offset:true}),
 approvedSignedImageHost:z.string().min(1), actorRoles:z.array(z.enum(["SALESPERSON","CLIENT_MANAGER"])).min(1),
 migrationState:z.literal("VERIFIED"),
 coverage:z.object({twoAgentsSameTenant:z.literal(true),twoTenants:z.literal(true),manager:z.literal(true),revokedSession:z.literal(true)}),
 checks:z.array(z.object({checkId:z.string(),result:z.literal("PASS"),evidenceSha256:z.string().regex(/^[a-f0-9]{64}$/)})),
});
export type PrivateImageAcceptanceBinding={backendOrigin:string;deployedRevision:string;contractVersion:number;actorRole:string;allowedSignedHosts:string[];now?:Date};
/** Trusted release-operator configuration only. No request, JWT or capability flag can approve evidence. */
export function privateImageAcceptanceMatches(value:unknown,binding:PrivateImageAcceptanceBinding):boolean {
 const result=packetSchema.safeParse(value);if(!result.success)return false;const p=result.data;
 let origin:string;
 try{const u=new URL(p.backendOrigin);if(u.protocol!=="https:"||u.username||u.password||u.search||u.hash||u.pathname!=="/")return false;origin=u.origin;}catch{return false;}
 if(origin!==binding.backendOrigin||p.deployedRevision!==binding.deployedRevision||p.contractVersion!==binding.contractVersion||!p.actorRoles.some(r=>r===binding.actorRole))return false;
 const now=(binding.now??new Date()).getTime(),verified=Date.parse(p.verifiedAt),expires=Date.parse(p.expiresAt);
 if(verified>now||expires<=now||expires<=verified||!binding.allowedSignedHosts.includes(p.approvedSignedImageHost))return false;
 return PRIVATE_IMAGE_ACCEPTANCE_CHECKS.every(id=>p.checks.some(c=>c.checkId===id&&c.result==="PASS"));
}
export function privateImagesAcceptedForCurrentRelease(actorRole:string):boolean {
 try {
  const json=process.env.SEGMIQ_RE_PRIVATE_IMAGE_ACCEPTANCE_JSON;
  const revision=process.env.VERCEL_GIT_COMMIT_SHA||process.env.SEGMIQ_RELEASE_REVISION;
  const configuredOrigin=process.env.SEGMIQ_PUBLIC_API_ORIGIN||process.env.NEXTAUTH_URL;
  const account=process.env.CLOUDFLARE_R2_ACCOUNT_ID,bucket=process.env.CLOUDFLARE_R2_PRIVATE_LISTING_BUCKET_NAME;
  if(!json||!revision||!configuredOrigin||!account||!bucket)return false;
  const origin=new URL(configuredOrigin);if(origin.protocol!=="https:"||origin.username||origin.password||origin.search||origin.hash||origin.pathname!=="/")return false;
  return privateImageAcceptanceMatches(JSON.parse(json),{backendOrigin:origin.origin,deployedRevision:revision,contractVersion:1,actorRole,allowedSignedHosts:[`${account}.r2.cloudflarestorage.com`,`${bucket}.${account}.r2.cloudflarestorage.com`]});
 }catch{return false;}
}
