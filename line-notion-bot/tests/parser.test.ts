import { describe, expect, it } from "vitest";
import fixtures from "./fixtures/messages.json";
import { parseMessage } from "../src/parser/index.js";

describe("parser fixtures", () => {
  it("classifies expected event types", () => {
    for (const row of fixtures) {
      const parsed = parseMessage(row.text);
      expect(parsed.type).toBe(row.expectType);
    }
  });

  it("assigns high confidence for complete shipped message", () => {
    const parsed = parseMessage("出貨 客戶王先生 金額120000 物流黑貓 單號123456789");
    expect(parsed.type).toBe("SHIPPED");
    expect(parsed.confidence).toBeGreaterThanOrEqual(0.75);
  });

  it("marks unknown for loose short message", () => {
    const parsed = parseMessage("王先生 E3MH 120000");
    expect(parsed.type).toBe("UNKNOWN");
    expect(parsed.confidence).toBeLessThan(0.5);
  });
});
