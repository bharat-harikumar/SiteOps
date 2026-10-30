import { expect, it } from "vitest";
import { movementErrorResponse } from "./http";
import { MovementError } from "./movement";
it("explains stale stock and available source quantities in friendly copy",async()=>{
 const stale=await movementErrorResponse(new MovementError("stale_version"),"test").json();
 expect(stale.error.message).toBe("Stock changed. Review the latest quantity before saving.");
 const insufficient=await movementErrorResponse(new MovementError("insufficient_source",2),"test").json();
 expect(insufficient.error.message).toBe("Only 2 available at the source.");expect(insufficient.error.details).toEqual({reason:"insufficient_source",available:2});
});
it("omits unpermitted availability and uses fixed copy for other failures",async()=>{
 const forbidden=await movementErrorResponse(new MovementError("forbidden_site",123),"test").json();
 expect(forbidden.error.message).toBe("You can only move tools between sites you supervise.");expect(forbidden.error.details).toEqual({reason:"forbidden_site"});
 for(const available of [undefined,-1,NaN,Infinity,1.5,1_000_001]){
  const body=await movementErrorResponse(new MovementError("insufficient_source",available),"test").json();
  expect(body.error.message).toBe("The source does not have enough tools for this move.");expect(body.error.details).toEqual({reason:"insufficient_source"});
 }
});
