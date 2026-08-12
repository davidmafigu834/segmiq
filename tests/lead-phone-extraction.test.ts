import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  extractPhoneFromFormData,
  looksLikePhoneNumber,
  parseLeadFields,
} from "../lib/lead-helpers";

describe("Facebook Instant Form phone extraction", () => {
  const shieldPayload = {
    email: "jacksonnyakambiri655@gmail.com",
    budget: "not_sure_yet",
    full_name: "Jackson Nyakambiri",
    phone_number: "+263710362101",
    project_type: "new_roof_installation",
    "do_you_already_know_the_gauge,_colour_and_design_you_want?_tell_us,_or_write_'need_advice'_if_not.":
      "need advice",
  };

  it("does not treat tell_us question answers as phone", () => {
    assert.equal(extractPhoneFromFormData(shieldPayload), "+263710362101");
    const parsed = parseLeadFields(shieldPayload);
    assert.equal(parsed.phone, "+263710362101");
    assert.equal(parsed.email, "jacksonnyakambiri655@gmail.com");
    assert.equal(parsed.name, "Jackson Nyakambiri");
  });

  it("rejects free-text as phone numbers", () => {
    assert.equal(looksLikePhoneNumber("need advice"), false);
    assert.equal(looksLikePhoneNumber("charcoal black"), false);
    assert.equal(looksLikePhoneNumber("+263710362101"), true);
  });

  it("prefers phone_number over ambiguous keys", () => {
    const phone = extractPhoneFromFormData({
      tell_us_more: "hello",
      phone_number: "+27715496022",
    });
    assert.equal(phone, "+27715496022");
  });
});
