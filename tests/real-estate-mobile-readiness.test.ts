import test from "node:test";
import assert from "node:assert/strict";
import { canReadListing, canAssignListingAgent, listingActions, listingVisibilityFilter, privateListingImageKey, listingReadDto } from "../lib/real-estate/listing-access";
const a = { userId: "agent-a", role: "SALESPERSON", clientId: "org-a" };
const own = { id: "listing-a", client_id: "org-a", agent_id: "agent-a", approval_status: "draft" };
test("own draft, pending and published listings are visible", () => { for (const approval_status of ["draft", "pending_approval", "approved"]) assert.equal(canReadListing(a, { ...own, approval_status }), true); });
test("other agents see approved and legacy published listings only", () => { for (const state of ["draft", "pending_approval", "rejected"]) assert.equal(canReadListing(a, { ...own, agent_id: "agent-b", approval_status: state }), false); assert.equal(canReadListing(a, { ...own, agent_id: "agent-b", approval_status: "approved" }), true); });
test("cross-tenant and unsupported roles fail closed", () => { assert.equal(canReadListing(a, {...own, client_id:"org-b"}), false); assert.equal(canReadListing({...a, role:"PROJECT_MEMBER"}, own), false); });
test("manager visibility and permitted actions", () => { assert.equal(listingActions({...a, role:"CLIENT_MANAGER"}, {...own, agent_id:"agent-b"}).approve,true); assert.equal(listingActions(a,{...own, approval_status:"approved"}).edit,false); });
test("agents cannot spoof or clear listing ownership", () => { assert.equal(canAssignListingAgent(a,"agent-b"),false); assert.equal(canAssignListingAgent(a,null),false); assert.equal(canAssignListingAgent(a,"agent-a"),true); });
test("query predicate includes own and published only", () => { assert.equal(listingVisibilityFilter(a),"agent_id.eq.agent-a,approval_status.eq.approved,approval_status.is.null"); assert.equal(listingVisibilityFilter({...a,role:"CLIENT_MANAGER"}),null); });
test("image namespace forbids other tenants, listings, documents, paths and URLs", () => { const good = "clients/org-a/listings/listing-a/photos/cover.webp"; assert.equal(privateListingImageKey(good,"org-a","listing-a"),good); for (const bad of [good.replace("org-a","org-b"),good.replace("listing-a","listing-b"),good.replace("photos/cover.webp","documents/owner.pdf"),good.replace("cover.webp","../owner.jpg"),"https://example.test/cover.jpg"]) assert.equal(privateListingImageKey(bad,"org-a","listing-a"),null); });
test("mobile DTO removes owner documents and legacy URLs; preserves private image ordering", () => { const dto = listingReadDto(a,{...own,owner_email:"private@example.test",documents:["owner.pdf"],photos:["https://example.test/old.jpg","clients/org-a/listings/listing-a/photos/two.jpg"]},true); assert.equal(dto.owner_email,undefined);assert.equal(dto.documents,undefined);assert.deepEqual(dto.photos,[]);assert.equal(dto.legacyImagesGated,true);assert.deepEqual(dto.images,[{index:1,cover:false,endpoint:"/api/clients/org-a/listings/listing-a/images/1"}]); });

test("actual PostgREST fallback preserves visibility, all filters, count, and stable page range", async () => {
  const { createClient } = await import("@supabase/supabase-js");
  const { loadListingPage } = await import("../lib/real-estate/listing-read-service");
  const requests: URL[] = [];
  const db = createClient("https://fake.example.test", "not-a-real-key", { global: { fetch: (async (input: RequestInfo | URL) => {
    const url = new URL(String(input)); requests.push(url);
    if (requests.length === 1) return new Response(JSON.stringify({code:"PGRST200",message:"Relationship missing"}),{status:400,headers:{"Content-Type":"application/json"}});
    return new Response("[]",{status:200,headers:{"Content-Type":"application/json","Content-Range":"0-0/0"}});
  }) as typeof fetch } });
  const result = await loadListingPage(db,a,"org-a",new URL("https://example.test?status=available&development_id=dev&suburb=Test&min_price=5&max_price=50&bedrooms=2&q=House&transaction_type=sale"),2,10);
  assert.equal(result.error,null); assert.equal(requests.length,2);
  for (const key of ["client_id","or","status","development_id","suburb","price","bedrooms","transaction_type","offset","limit","order"]) assert.deepEqual(requests[0].searchParams.getAll(key),requests[1].searchParams.getAll(key),key);
  assert.equal(requests[1].searchParams.get("client_id"),"eq.org-a");
  assert.match(requests[1].searchParams.get("or")!,/agent_id.eq.agent-a/);
  assert.match(requests[1].searchParams.get("or")!,/approval_status.eq.approved/);
  assert.equal(requests[1].searchParams.get("offset"),"10"); assert.equal(requests[1].searchParams.get("limit"),"10");
});

test("accepted introduction no longer grants access after buyer reassignment", async () => {
  const { canViewBuyerOnListing } = await import("../lib/real-estate/buyer-contact-access");
  const input = { actor:{id:"requester",role:"SALESPERSON",clientId:"org-a"},recordClientId:"org-a",contactId:"contact",searches:[{id:"search",clientId:"org-a",contactId:"contact",assignedAgentId:"new-agent",status:"active",pipelineStage:"new"}],listing:{id:"listing",clientId:"org-a",status:"available",approvalStatus:"approved"},introductions:[{clientId:"org-a",listingId:"listing",searchId:"search",requestingAgentId:"requester",owningAgentId:"old-agent",status:"accepted"}] };
  assert.equal(canViewBuyerOnListing(input),false);
});

test("buyer service enforces own search reads, manager scope and null-reassignment denial against PostgREST", async () => {
  const { createFakePostgrest } = await import("./helpers/fake-postgrest");
  const previousFetch = globalThis.fetch;
  const previousUrl = process.env.NEXT_PUBLIC_SUPABASE_URL, previousKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://fake.example.test"; process.env.SUPABASE_SERVICE_ROLE_KEY = "test-key-not-real";
  const db = createFakePostgrest("https://fake.example.test", {
    real_estate_buyer_searches: [
      {id:"search-a",client_id:"org-a",contact_id:"contact-a",assigned_agent_id:"agent-a",status:"paused",pipeline_stage:"new"},
      {id:"search-b",client_id:"org-a",contact_id:"contact-b",assigned_agent_id:"agent-b",status:"active",pipeline_stage:"new"}
    ], contacts:[{id:"contact-a",client_id:"org-a",name:"Fictitious Buyer",phone:"test"}]
  });
  globalThis.fetch = db.fetch;
  try {
    const { getBuyerSearchBundle, listBuyerSearches, updateBuyerSearch } = await import("../lib/real-estate/buyer-sales-service");
    const actor = {id:"agent-a",name:"Agent A",role:"SALESPERSON",clientId:"org-a"};
    const own = await getBuyerSearchBundle("org-a","search-a",actor); assert.equal(own.ok,true);
    const other = await getBuyerSearchBundle("org-a","search-b",actor); assert.equal(other.ok,false); if (!other.ok) assert.equal(other.status,403);
    assert.equal((await getBuyerSearchBundle("org-a","search-b",{...actor,role:"CLIENT_MANAGER"})).ok,true);
    const reassignment = await updateBuyerSearch({clientId:"org-a",searchId:"search-a",actor,patch:{assignedAgentId:null}}); assert.equal(reassignment.ok,false); if (!reassignment.ok) assert.equal(reassignment.status,403);
    const page = await listBuyerSearches({clientId:"org-a",actor,agentId:"agent-b"}); assert.equal(page.ok,true); if (page.ok) assert.deepEqual(page.searches.map(row => row.id),["search-a"]);
    assert.equal((await listBuyerSearches({clientId:"org-b",actor})).ok,false);
    assert.equal((await listBuyerSearches({clientId:"org-a",actor,page:NaN})).ok,false);
  } finally { globalThis.fetch = previousFetch; if(previousUrl === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_URL; else process.env.NEXT_PUBLIC_SUPABASE_URL=previousUrl; if(previousKey === undefined) delete process.env.SUPABASE_SERVICE_ROLE_KEY; else process.env.SUPABASE_SERVICE_ROLE_KEY=previousKey; }
});
