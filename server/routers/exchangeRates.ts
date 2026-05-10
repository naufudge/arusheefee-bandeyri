import { router, permissionProcedure } from "../trpc";
import { TRPCError } from "@trpc/server";
import * as cheerio from "cheerio";
import axios from "axios";

const MMA_CROSSRATES_URL = "http://www.mma.gov.mv/crossrates.php";
const MVR_TO_DOLLAR = 15.42;

export const exchangeRatesRouter = router({
  // GET /exchange_rates - Scrape MMA website for live rates.
  // Used by PvForm to fill in the rate when currency changes; gating
  // behind pv:read keeps it consistent with anyone who can see PVs.
  get: permissionProcedure("pv:read").query(async () => {
    try {
      const response = await axios.get(MMA_CROSSRATES_URL, {
        headers: {
          "User-Agent": "Mozilla/5.0 (compatible; ArchivaApp/1.0)",
        },
      });

      const html = response.data;
      const $ = cheerio.load(html);
      const rows = $("tr");

      const tempData: [string, string][] = [];
      rows.each((i, row) => {
        // Skip first and last rows (header and footer)
        if (i !== 0 && i !== rows.length - 1) {
          const cells = $(row).find("td");
          const currency = $(cells[1]).text().trim();
          const rate = $(cells[2]).text().trim();
          if (currency && rate) {
            tempData.push([currency, rate]);
          }
        }
      });

      // Convert rates to MVR
      const rates: Record<string, number> = {
        USD: MVR_TO_DOLLAR,
      };

      for (const [currency, usdRate] of tempData) {
        const parsedRate = parseFloat(usdRate);
        if (!isNaN(parsedRate) && parsedRate > 0) {
          const mvrValue = MVR_TO_DOLLAR / parsedRate;
          if (Math.round(mvrValue * 100) / 100 > 0.1) {
            rates[currency] = Math.round(mvrValue * 100) / 100;
          } else {
            rates[currency] = mvrValue;
          }
        }
      }

      return rates;
    } catch (error) {
      if (error instanceof TRPCError) throw error;
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Failed to parse exchange rates",
      });
    }
  }),
});
