export function analyzeProperty(data, metrics) {
    // Defaults for missing data in old scenarios
    const locationType = Number(data.locationType) || 3;
    const conditionType = Number(data.conditionType) || 3;
    const marketPricing = data.marketPricing || 'fair';

    // Correct paths from finance.js structure
    const netYield = metrics.operations?.netYield || 0;
    const initialDscr = metrics.financing?.stressDscr || 0;
    const cashOnCashAvg = metrics.returnMetrics?.cashOnCashAvg || 0;
    const irr = metrics.returnMetrics?.irr || 0;
    const roeAvg = metrics.returnMetrics?.roeAvg || 0;
    const equityNow = metrics.acquisition?.equityNow || 0;
    const totalInvestment = metrics.acquisition?.totalInvestment || 0;

    // Core KPIs
    const yieldScore = Math.min(10, Math.max(0, (netYield - 1.5) * 2)); // 1.5% = 0, 6.5% = 10
    const dscrScore = !isFinite(initialDscr) ? 10 : Math.min(10, Math.max(0, (initialDscr - 1.0) * 10)); // 1.0 = 0, 2.0 = 10
    const cocScore = Math.min(10, Math.max(0, cashOnCashAvg * 1.25)); // 0% = 0, 8% = 10
    const irrScore = Math.min(10, Math.max(0, (irr - 2) * 1.25)); // 2% = 0, 10% = 10


    // Qualitative Scores
    const locationScore = (locationType - 1) * 2.5; // 1->0, 3->5, 5->10
    const conditionScore = (conditionType - 1) * 2.5; // 1->0, 5->10

    // Market Pricing Score (value opportunity)
    let pricingScore = 5; // Neutral baseline
    let pricingBonus = 0;
    if (marketPricing === 'under') {
        pricingScore = 10; // Maximum value
        pricingBonus = 5; // Bonus points for underpriced deals
    } else if (marketPricing === 'over') {
        pricingScore = 0; // Poor value
        pricingBonus = -5; // Penalty for overpriced deals
    }

    // Weighted Total (0-100) - now includes pricing and IRR
    const financialTotal = (yieldScore * 0.25 + dscrScore * 0.3 + cocScore * 0.2 + irrScore * 0.25);
    const qualityTotal = (locationScore * 0.5 + conditionScore * 0.3 + pricingScore * 0.2);
    const baseScore = Math.round((financialTotal * 5 + qualityTotal * 5));
    const finalScore = Math.min(100, Math.max(0, baseScore + pricingBonus));


    // Determine investment strategy profile
    let strategyProfile = "balanced";
    if (netYield >= 5 && locationType <= 3) {
        strategyProfile = "cashflow";
    } else if (locationType >= 4 && netYield < 4) {
        strategyProfile = "appreciation";
    }

    // Build detailed insights
    const insights = [];

    // Market pricing insights (PRIORITY - shown first)
    if (marketPricing === 'under') {
        insights.push("💰 Under market price - strong value opportunity");
    } else if (marketPricing === 'over') {
        insights.push("⚠️ Above market price - limited upside");
    }

    // Yield analysis
    if (netYield >= 5) {
        insights.push("✅ Excellent net yield (>5%)");
    } else if (netYield >= 3.5) {
        insights.push("👍 Solid net yield (3.5-5%)");
    } else {
        insights.push("⚠️ Low yield (<3.5%), relies on appreciation");
    }

    // CoC analysis
    if (cashOnCashAvg >= 8) {
        insights.push("✅ Strong positive cash flow (>8%)");
    } else if (cashOnCashAvg >= 3) {
        insights.push("👍 Moderate positive cash flow (3-8%)");
    } else {
        insights.push("⚠️ Low or negative cash flow (<3%)");
    }

    // Risk assessment (DSCR 80% LTV Stress)
    if (initialDscr < 1.0) {
        insights.push("❌ Tight debt coverage at 80% LTV (<1.0)");
    } else if (initialDscr >= 1.20) {
        insights.push("✅ Strong debt coverage at 80% LTV (>1.20)");
    }

    // IRR Analysis
    if (irr >= 10) {
        insights.push("✅ Excellent long-term return potential (>10% IRR)");
    } else if (irr >= 5) {
        insights.push("👍 Solid long-term return potential (5-10% IRR)");
    } else {
        insights.push("⚠️ Weak long-term return potential (<5% IRR)");
    }

    // Location insights
    const locationLabels = ["C-Location", "C+ Location", "B-Location", "B+ Location", "A-Location"];
    const locationLabel = locationLabels[locationType - 1] || "Unknown";

    if (locationType >= 4) {
        insights.push(`${locationLabel}: Premium area`);
    } else if (locationType <= 2) {
        insights.push(`${locationLabel}: Higher vacancy risk`);
    }

    // Condition insights
    if (conditionType <= 2) {
        insights.push("Renovation required");
    } else if (conditionType >= 4) {
        insights.push("Move-in ready");
    }

    // Generate summary based on score and profile
    let summary = "";
    let tags = [];

    if (finalScore >= 80) {
        summary = "💎 Exceptional Deal";
        tags.push("Top Tier");
    } else if (finalScore >= 70) {
        summary = "✅ Strong Investment";
        tags.push("Solid");
    } else if (finalScore >= 55) {
        summary = "👍 Good Opportunity";
        tags.push("Good");
    } else if (finalScore >= 40) {
        summary = "⚠️ Moderate Risk";
        tags.push("Average");
    } else {
        summary = "❌ High Risk";
        tags.push("Risky");
    }

    // Add strategy tag
    if (strategyProfile === "cashflow") {
        tags.push("Cash Flow");
    } else if (strategyProfile === "appreciation") {
        tags.push("Appreciation");
    } else {
        tags.push("Balanced");
    }

    // Add value tag
    if (marketPricing === 'under') {
        tags.push("Value Deal");
    } else if (marketPricing === 'over') {
        tags.push("Premium Price");
    }

    return {
        score: finalScore,
        summary: summary,
        tags: tags,
        insights: insights,
        strategyProfile: strategyProfile,
        details: {
            financial: Math.round(financialTotal * 10),
            quality: Math.round(qualityTotal * 10),
            yield: netYield,
            dscr: initialDscr, // Now using stressDscr
            coc: cashOnCashAvg,
            irr: irr,
            roe: roeAvg,
            equity: equityNow,
            location: locationType,
            condition: conditionType,
            marketPricing: marketPricing
        }
    };
}

// New function for comparative analysis
export function compareProperties(properties) {
    if (!properties || properties.length < 2) {
        return null;
    }

    const analyses = properties.map(p => analyzeProperty(p.data, p.metrics));

    // Find best performers for each category
    const bestYield = analyses.reduce((best, curr, idx) =>
        curr.details.yield > analyses[best].details.yield ? idx : best, 0);
    const bestCashFlow = analyses.reduce((best, curr, idx) =>
        curr.details.coc > analyses[best].details.coc ? idx : best, 0);
    const bestIRR = analyses.reduce((best, curr, idx) =>
        curr.details.irr > analyses[best].details.irr ? idx : best, 0);
    const bestRisk = analyses.reduce((best, curr, idx) =>
        curr.details.dscr > analyses[best].details.dscr ? idx : best, 0);
    const lowestEquity = analyses.reduce((best, curr, idx) =>
        curr.details.equity < analyses[best].details.equity ? idx : best, 0);

    // Calculate equity multiples
    const equityMultiples = properties.map(p => p.metrics.returnMetrics?.equityMultiple || 0);
    const bestEquityMultiple = equityMultiples.reduce((best, curr, idx) =>
        curr > equityMultiples[best] ? idx : best, 0);

    // Determine overall winner based on weighted scoring (Balanced View)
    // IRR (45%), Risk/DSCR (15%), Cash-on-Cash (20%), Equity Multiple (20%)
    const scores = analyses.map((a, idx) => {
        const irrScore = Math.min((a.details.irr / 15) * 45, 45); // 15% IRR = max 45 pts
        const dscrScore = Math.min(((a.details.dscr - 1) / 0.4) * 15, 15); // 1.4+ DSCR = max 15 pts
        const cocScore = Math.min((a.details.coc / 10) * 20, 20); // 10% CoC = max 20 pts
        const emScore = Math.min((equityMultiples[idx] / 2.5) * 20, 20); // 2.5x MOIC = max 20 pts
        return irrScore + dscrScore + cocScore + emScore;
    });

    const overallWinner = scores.reduce((best, curr, idx) =>
        curr > scores[best] ? idx : best, 0);

    // Generate comparative insights
    const comparativeInsights = [];

    // Head-to-head comparison
    if (properties.length === 2) {
        const [p1, p2] = analyses;
        const yieldDiff = Math.abs(p1.details.yield - p2.details.yield);
        const equityDiff = Math.abs(p1.details.equity - p2.details.equity);
        const irrDiff = Math.abs(p1.details.irr - p2.details.irr);
        const cocDiff = Math.abs(p1.details.coc - p2.details.coc);

        if (yieldDiff > 0.5) {
            const winner = p1.details.yield > p2.details.yield ? 0 : 1;
            comparativeInsights.push({
                type: "yield",
                winner: winner,
                message: `${yieldDiff.toFixed(1)}% higher net yield`
            });
        }

        if (equityDiff > 10000) {
            const winner = p1.details.equity < p2.details.equity ? 0 : 1;
            comparativeInsights.push({
                type: "equity",
                winner: winner,
                message: `€${Math.round(equityDiff / 1000)}k less equity required`
            });
        }

        if (irrDiff > 1) {
            const winner = p1.details.irr > p2.details.irr ? 0 : 1;
            comparativeInsights.push({
                type: "irr",
                winner: winner,
                message: `${irrDiff.toFixed(1)}% higher IRR (long-term return)`
            });
        }

        if (cocDiff > 1) {
            const winner = p1.details.coc > p2.details.coc ? 0 : 1;
            comparativeInsights.push({
                type: "coc",
                winner: winner,
                message: `${cocDiff.toFixed(1)}% higher cash-on-cash (annual return)`
            });
        }

        // Trade-off analysis
        if (p1.details.irr > p2.details.irr && p1.details.equity > p2.details.equity) {
            comparativeInsights.push({
                type: "tradeoff",
                message: `Property 1: Higher IRR (+${irrDiff.toFixed(1)}%) but needs €${Math.round(equityDiff / 1000)}k more equity`
            });
        } else if (p2.details.irr > p1.details.irr && p2.details.equity > p1.details.equity) {
            comparativeInsights.push({
                type: "tradeoff",
                message: `Property 2: Higher IRR (+${irrDiff.toFixed(1)}%) but needs €${Math.round(equityDiff / 1000)}k more equity`
            });
        }
    }

    // Generate winner recommendation
    const winner = analyses[overallWinner];
    const winnerMetrics = properties[overallWinner].metrics;

    let recommendation = {
        winnerIndex: overallWinner,
        winnerName: properties[overallWinner].name,
        headline: "",
        reasons: [],
        tradeoffs: []
    };

    // Build headline
    if (scores[overallWinner] >= 70) {
        recommendation.headline = "🏆 Clear Winner";
    } else if (scores[overallWinner] >= 50) {
        recommendation.headline = "✅ Recommended Choice";
    } else {
        recommendation.headline = "⚖️ Marginal Advantage";
    }

    // Build reasons
    if (overallWinner === bestIRR) {
        recommendation.reasons.push(`Best long-term return (${winner.details.irr.toFixed(1)}% IRR)`);
    }
    if (overallWinner === bestRisk) {
        recommendation.reasons.push(`Strongest debt coverage (Stress DSCR ${winner.details.dscr.toFixed(2)})`);
    }
    if (overallWinner === bestCashFlow) {
        recommendation.reasons.push(`Highest annual cash flow (${winner.details.coc.toFixed(1)}% CoC)`);
    }
    if (overallWinner === bestEquityMultiple) {
        recommendation.reasons.push(`Best capital efficiency (${equityMultiples[overallWinner].toFixed(2)}x return)`);
    }

    // Identify trade-offs (what you're giving up)
    const otherIndices = analyses.map((_, idx) => idx).filter(idx => idx !== overallWinner);
    otherIndices.forEach(idx => {
        if (idx === bestCashFlow && overallWinner !== bestCashFlow) {
            const diff = analyses[idx].details.coc - winner.details.coc;
            if (diff > 1) {
                recommendation.tradeoffs.push(`${diff.toFixed(1)}% lower Year 1 cash flow than Property ${idx + 1}`);
            }
        }
        if (idx === lowestEquity && overallWinner !== lowestEquity) {
            const diff = winner.details.equity - analyses[idx].details.equity;
            if (diff > 10000) {
                recommendation.tradeoffs.push(`€${Math.round(diff / 1000)}k more equity needed than Property ${idx + 1}`);
            }
        }
    });

    return {
        bestYield,
        bestCashFlow,
        bestIRR,
        bestRisk,
        lowestEquity,
        bestEquityMultiple,
        overallWinner,
        scores,
        comparativeInsights,
        recommendation,
        analyses
    };
}
