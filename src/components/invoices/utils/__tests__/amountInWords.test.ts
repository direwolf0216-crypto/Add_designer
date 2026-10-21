import { describe, expect, it } from "vitest";
import { amountInWords } from "../amountInWords";

describe("amountInWords", () => {
  it("writes rupees in the Indian system", () => {
    expect(amountInWords(5900)).toBe("Rupees Five Thousand Nine Hundred Only");
    expect(amountInWords(4698)).toBe("Rupees Four Thousand Six Hundred Ninety Eight Only");
    expect(amountInWords(125000)).toBe("Rupees One Lakh Twenty Five Thousand Only");
    expect(amountInWords(10267834)).toBe("Rupees One Crore Two Lakh Sixty Seven Thousand Eight Hundred Thirty Four Only");
    expect(amountInWords(0)).toBe("Rupees Zero Only");
  });

  it("adds paise", () => {
    expect(amountInWords(1250.5)).toBe("Rupees One Thousand Two Hundred Fifty and Fifty Paise Only");
    expect(amountInWords(19.05)).toBe("Rupees Nineteen and Five Paise Only");
  });
});
