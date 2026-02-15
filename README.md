# German Real Estate Investment Analyzer

A professional-grade, browser-based real estate investment analysis tool tailored for the German market. It models leveraged property acquisitions with deep support for local tax laws, financing structures, and wealth projection.

## 🚀 Quick Start
1.  **Input Acquisition Data:** Enter the purchase price and local *Kaufnebenkosten* (Tax, Notary, Broker).
2.  **Set Financing:** Configure your bank loan and optional **KfW secondary loans** (e.g., Program 261 for renovations).
3.  **Optimize Taxes:** Set your personal tax rate and choose between Linear or Degressive **AfA (Depreciation)**.
4.  **Analyze & Save:** Review the Dashboard metrics and click **"Save Search"** to store the scenario.
5.  **Compare Deals:** Select multiple saved searches and switch to the **"Comparison"** tab for a side-by-side winner analysis.

---

## 🇩🇪 Investor Guide: Buying Profitable Property in Germany

To identify a truly profitable deal, you must look beyond the "Gross Yield." This tool helps you navigate the "German Alpha":

### 1. The "Kaufnebenkosten" Reality
In Germany, purchase costs (up to 12%+) are usually paid from equity. 
*   **Tax (Grunderwerbsteuer):** 3.5% to 6.5% depending on the Bundesland.
*   **Notary/Registry:** ~2.0%.
*   **Broker:** ~3.57%.
*   *Tip: Use the "Renovation" field for immediate tax write-offs in Year 1 if costs are <15% of building value.*

### 2. Understanding Key Metrics
| Metric | Target | German Context |
| :--- | :--- | :--- |
| **Net Yield** | > 4% | Return after non-recoverable costs (*Hausverwaltung*, *Instandhaltung*). |
| **DSCR** | > 1.1 | Bankability. If < 1.0, you are "paying" to own the property every month. |
| **Cash-on-Cash** | > 5% | Your actual dividend on the cash you put into the deal. |
| **IRR (Levered)** | > 10% | Total return including the **tax-free sale after 10 years** (*Spekulationsfrist*). |

### 3. Tax Optimization (AfA)
*   **Linear AfA:** 2%, 2.5% or 3% based on build year.
*   **Special AfA:** Toggle the **5% Special AfA** for new builds to significantly reduce your taxable income in the first 4 years.
*   **Tax Savings:** The "Tax Savings" metric shows how much of your personal income tax is reduced by property depreciation and interest.

### 4. Wealth Projection
The **"Total Economic Benefit"** is the most important number for long-term investors. It combines:
1.  **Amortization:** Your tenants paying down your debt.
2.  **Appreciation:** Market value growth.
3.  **Tax Savings:** Cash kept in your pocket due to German tax laws.

---

## 🛠 Technical Overview
*   **Financial Engine:** [`assets/js/finance.js`](assets/js/finance.js) handles complex IRR iterations, degressive depreciation, and multi-loan amortization schedules.
*   **Investment Advisor:** [`assets/js/advisor.js`](assets/js/advisor.js) uses weighted scoring (Yield, Risk, Quality) to provide qualitative insights.
*   **State Management:** [`assets/js/state.js`](assets/js/state.js) manages local storage for privacy-first, client-side data persistence.
*   **UI:** Built with modern CSS variables and a responsive grid for desktop-first professional analysis.

---

## ⚖️ Strategy Profiles
*   **Cash Flow:** High yield (>5.5%), C-Location, higher risk but immediate monthly income.
*   **Appreciation:** Low yield (<3.5%), A-Location (Berlin/Munich), relies on the 10-year tax-free exit.
*   **Balanced:** B-Location, stable rent, moderate growth, DSCR > 1.2.
