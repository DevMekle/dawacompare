// Illustrative drawings of fictional blister packs for the sample scenarios.
// They are drawings, not photos of real products.

import type { ScenarioId } from "./scenarios";

interface StripOpts { brand: string; salt: string; strength: string; mrp: string; band: string; pills: number; tear?: boolean; smudge?: boolean }

function strip(o: StripOpts): string {
  const cols = o.pills / 2;
  const cellW = 520 / cols;
  let bubbles = "";
  for (let r = 0; r < 2; r++)
    for (let c = 0; c < cols; c++) {
      const cx = 60 + cellW * c + cellW / 2;
      const cy = 210 + r * 80;
      bubbles += `<ellipse cx="${cx}" cy="${cy}" rx="${cellW * 0.32}" ry="26" fill="#f6f6f1" stroke="#9aa5a0" stroke-width="2"/><ellipse cx="${cx - 8}" cy="${cy - 9}" rx="${cellW * 0.12}" ry="6" fill="#fff" opacity=".7"/>`;
    }
  const tear = o.tear ? `<path d="M140 40 L196 40 L188 70 L204 96 L184 126 L198 150 L140 150 Z" fill="#dfe5e1"/>` : "";
  const smudge = o.smudge ? `<ellipse cx="92" cy="114" rx="34" ry="13" fill="${o.band}" opacity=".85" filter="url(#b)"/>` : "";
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 380">
<defs><filter id="b"><feGaussianBlur stdDeviation="4"/></filter></defs>
<rect width="640" height="380" fill="#dfe5e1"/>
<g transform="rotate(-3 320 190)">
<rect x="40" y="40" width="560" height="310" rx="14" fill="#eef1ef" stroke="#b9c2bd" stroke-width="2"/>
<rect x="40" y="40" width="560" height="110" rx="14" fill="${o.band}"/><rect x="40" y="130" width="560" height="20" fill="${o.band}"/>
<text x="64" y="88" font-family="Arial,sans-serif" font-weight="700" font-size="34" fill="#fff">${o.brand}</text>
<text x="64" y="120" font-family="Arial,sans-serif" font-size="17" fill="#fff" opacity=".9">${o.strength} · ${o.salt}</text>
<text x="576" y="88" text-anchor="end" font-family="Arial,sans-serif" font-size="15" fill="#fff" opacity=".9">MRP ₹${o.mrp}</text>
<text x="576" y="120" text-anchor="end" font-family="Arial,sans-serif" font-size="13" fill="#fff" opacity=".75">SAMPLE · NOT A REAL PRODUCT</text>
${smudge}${tear}${bubbles}
</g></svg>`;
  return "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg);
}

export const SAMPLE_PACKS: Partial<Record<ScenarioId, { img: string; file: string }>> = {
  matched: { img: strip({ brand: "GLUCORA SR 500", salt: "Metformin HCl (SR)", strength: "500 mg", mrp: "40.00 / 10", band: "#1d5e8c", pills: 10 }), file: "glucora-sr-500-sample.svg" },
  ambiguous_release: { img: strip({ brand: "GLUC     500", salt: "Metformin HCl", strength: "500 mg", mrp: "—", band: "#1d5e8c", pills: 10, tear: true }), file: "glucora-torn-sample.svg" },
  strength_mismatch: { img: strip({ brand: "TELVIA 40", salt: "Telmisartan", strength: "40 mg", mrp: "96.00 / 14", band: "#8c2a3a", pills: 14, smudge: true }), file: "telvia-40-smudged-sample.svg" },
};
