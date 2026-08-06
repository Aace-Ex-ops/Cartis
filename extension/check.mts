import assert from "node:assert";
import { parsePrice, detectCurrency, findByType, collect, type JsonLd } from "./lib/scraper.ts";

const pd: JsonLd = {
  "@context": "https://schema.org",
  "@type": "Product",
  name: "Sony WH-1000XM5",
  offers: { "@type": "Offer", price: "₹24,990", priceCurrency: "INR" },
  aggregateRating: { "@type": "AggregateRating", ratingValue: "4.6", reviewCount: "1200" },
  image: "https://img/sony.png",
};

const graphPd: JsonLd = { "@type": "@graph", "@graph": [{ "@type": "Product", name: "Nike Air", offers: { "@type": "Offer", price: "$89.99", priceCurrency: "USD" } }] };

const aggPd: JsonLd = { "@type": "Product", name: "Hotel", offers: { "@type": "AggregateOffer", lowPrice: "120", highPrice: "200", priceCurrency: "EUR" } };

assert.equal(parsePrice("₹1,29,999"), 129999);
assert.equal(parsePrice("$1,299.99"), 1299.99);
assert.equal(parsePrice("€ 120"), 120);
assert.equal(parsePrice("no price here"), undefined);
assert.equal(detectCurrency("₹1,29,999"), "INR");
assert.equal(detectCurrency("$1,299.99"), "USD");
assert.equal(detectCurrency("nothing"), "");
assert.equal(detectCurrency("120", "EUR"), "EUR");

assert.equal(findByType([pd], "Product")?.name, "Sony WH-1000XM5" ?? "Sony WH-1000XM5");
const offer = collect(pd).find((n) => n["@type"] === "Offer");
assert.ok(offer, "nested Offer found");
assert.equal(offer.price, "₹24,990");
assert.equal(collect(graphPd).some((n) => n["@type"] === "Product"), true);
assert.equal(collect(graphPd).find((n) => n["@type"] === "Offer")?.price, "$89.99");

const aggOffer = collect(aggPd).find((n) => n["@type"] === "AggregateOffer");
assert.equal(aggOffer?.lowPrice, 120);
assert.equal(aggOffer?.priceCurrency, "EUR");

const low = collect(aggPd).find((n) => (n["@type"] === "AggregateOffer" ? "lowPrice" in n : false));
assert.equal(low?.lowPrice, 120);

console.log("scraper helpers OK");