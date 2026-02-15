/* --- Financial Utilities --- */
export function calculateIRR(cashFlows, guess = 0.1) {
    const maxIterations = 1000;
    const precision = 1e-7;
    let rate = guess;

    // Check if all cash flows are close to zero
    const totalCashFlow = cashFlows.reduce((sum, cf) => sum + Math.abs(cf), 0);
    if (totalCashFlow < precision) {
        return 0;
    }

    for (let i = 0; i < maxIterations; i++) {
        let npv = 0;
        let dNpv = 0;

        for (let t = 0; t < cashFlows.length; t++) {
            npv += cashFlows[t] / Math.pow(1 + rate, t);
            dNpv -= (t * cashFlows[t]) / Math.pow(1 + rate, t + 1);
        }

        if (Math.abs(npv) < precision) {
            return rate * 100;
        }

        if (Math.abs(dNpv) < precision) break;
        rate -= npv / dNpv;
    }
    return null;
}

/* --- Main Calculation Engine --- */

export function calculateMetrics(inputs) {
    const {
        // Acquisition
        purchasePrice,
        transferTaxPercent, // Grunderwerbsteuer
        notaryPercent,      // Notar & Grundbuch
        brokerPercent,      // Makler
        sizeSqm,            // Size in m²

        // Property Specs
        buildingSharePercent, // For AfA base

        // Operations
        monthlyColdRent,
        vacancyRatePercent,
        operatingCostsMonthly, // Non-recoverable
        mgmtCostsMonthly,
        maintenanceReserveMonthly,

        // Growth Assumptions
        rentIncreasePercent,
        costIncreasePercent,
        propertyAppreciationPercent,

        // Financing
        loanPercent,
        interestRatePercent,
        repaymentRatePercent,
        loanTermYears,

        // Tax
        afaRatePercent,
        taxRatePercent,
        holdingPeriodYears,
        capitalGainsTaxRate, // If < 10y
        renovationCost,
        furnitureCost,

        // KFW Specifics
        useKfwLoan,
        kfwLoanType,
        kfwLoanAmount,
        kfwInterestRate,
        kfwRepaymentRate,
        kfwGracePeriod,
        kfwTilgungszuschuss,
        isLinearAfa,
        useSpecialAfa
    } = inputs;

    // --- Loan Setup (Split Logic) ---
    let totalLoanAmount = purchasePrice * (loanPercent / 100);
    totalLoanAmount += renovationCost + furnitureCost;

    let bankLoanAmount = totalLoanAmount;
    let kfwAmount = 0;

    let kfwSubsidyAmount = 0; // Tilgungszuschuss

    if (useKfwLoan) {
        kfwAmount = Number(kfwLoanAmount) || 0;
        // Cap KFW amount at total requirement (simple logic, or allow over-leverage? usually capped)
        // For now, assume KFW replaces a part of the bank loan.
        if (kfwAmount > totalLoanAmount) kfwAmount = totalLoanAmount;
        bankLoanAmount = totalLoanAmount - kfwAmount;

        // Calculate Subsidy (Tilgungszuschuss)
        // Only for KFW 261 (Renovation)
        if (kfwLoanType === '261') {
            kfwSubsidyAmount = kfwAmount * (kfwTilgungszuschuss / 100);
        }
    }

    // Balances
    let currentBankBalance = bankLoanAmount;
    let currentKfwBalance = kfwAmount - kfwSubsidyAmount; // Start with reduced balance if subsidy applies immediately
    let currentTotalBalance = currentBankBalance + currentKfwBalance;


    // --- 1. Acquisition & Setup ---
    const purchaseCostsPercent = transferTaxPercent + notaryPercent + brokerPercent;
    const purchaseCosts = purchasePrice * (purchaseCostsPercent / 100);
    const totalInvestment = purchasePrice + purchaseCosts + renovationCost + furnitureCost;

    // Equity is Total Cost - (Bank Loan + KFW Loan Payout Amount).
    // Note: KFW pays out 100% usually, acts as full loan, then subsidy reduces debt.
    // So Equity = Invest - (Bank + KfwOriginal). The Subsidy is distinct wealth gain.
    const equityNow = totalInvestment - (bankLoanAmount + kfwAmount);

    // AfA Base
    const afaBaseValue = purchasePrice * (buildingSharePercent / 100);
    // const annualDepreciation = afaBaseValue * (afaRatePercent / 100); // MOVED INSIDE LOOP

    // --- 2. Timeline Projection ---
    let timeline = [];
    let cumulativeCashFlow = 0;
    let cumulativeTaxSavings = 0;
    let currentBookValue = afaBaseValue; // Track residual value for degressive AfA

    // Growth Iterators (Annualized for calculation)
    let currentMonthlyRent = monthlyColdRent;
    let currentOpCosts = operatingCostsMonthly * 12;
    let currentMgmtCosts = mgmtCostsMonthly * 12;
    let currentMaint = maintenanceReserveMonthly * 12;

    for (let year = 1; year <= holdingPeriodYears; year++) {
        // A. Operational Cash Flow
        const potentialRent = currentMonthlyRent * 12;
        const vacancyLoss = potentialRent * (vacancyRatePercent / 100);
        const effectiveGrossIncome = potentialRent - vacancyLoss;

        const opsCostVal = (Number(currentOpCosts) || 0) + (Number(currentMgmtCosts) || 0) + (Number(currentMaint) || 0);
        const noi = effectiveGrossIncome - opsCostVal;

        // B. Debt Service (Split)
        // B1. Bank Loan
        // Annuity = Original * (Rate + Repay)
        const bankAnnuity = bankLoanAmount * ((interestRatePercent + repaymentRatePercent) / 100);
        const bankInterest = currentBankBalance * (interestRatePercent / 100);
        let bankPrincipal = bankAnnuity - bankInterest;
        if (bankPrincipal > currentBankBalance) bankPrincipal = currentBankBalance;
        if (bankPrincipal < 0) bankPrincipal = 0; // Safety if stats are weird

        // B2. KFW Loan
        let kfwInterest = 0;
        let kfwPrincipal = 0;
        if (useKfwLoan && currentKfwBalance > 0) {
            kfwInterest = currentKfwBalance * (kfwInterestRate / 100);

            // Check Grace Period (Tilgungsfreie Anlaufjahre)
            if (year <= kfwGracePeriod) {
                kfwPrincipal = 0;
            } else {
                // Standard Annuity after grace period base on ORIGINAL amount (usually) or Remaining?
                // KFW usually fixes the annuity based on the loan amount.
                // New logic: If we have a planned Repayment Rate, calculate annuity.
                const kfwAnnuity = (kfwAmount - kfwSubsidyAmount) * ((kfwInterestRate + kfwRepaymentRate) / 100);
                kfwPrincipal = kfwAnnuity - kfwInterest;
            }
            if (kfwPrincipal > currentKfwBalance) kfwPrincipal = currentKfwBalance;
            if (kfwPrincipal < 0) kfwPrincipal = 0;
        }

        const totalInterest = bankInterest + kfwInterest;
        const totalPrincipal = bankPrincipal + kfwPrincipal;
        const actualDebtService = totalInterest + totalPrincipal;

        // C. Tax Calculation

        // --- NEW DEPRECIATION LOGIC ---
        let annualDepreciation = 0;
        const specialAfa = useSpecialAfa && year <= 4 ? afaBaseValue * 0.05 : 0;
        let baseAfa = 0;

        if (isLinearAfa) {
            // Linear depreciation based on the initial AfA base value
            baseAfa = afaBaseValue * (afaRatePercent / 100);
        } else {
            // Degressive depreciation based on the current book value
            baseAfa = currentBookValue * (afaRatePercent / 100);
        }

        annualDepreciation = baseAfa + specialAfa;
        // --- END NEW LOGIC ---


        // Update Book Value for next year (or exit calc)
        currentBookValue -= baseAfa; // Note: Sonder-AfA does not reduce the book value for the base AfA calculation
        if (currentBookValue < 0) currentBookValue = 0;


        // Furniture Depreciation (Linear 10y)
        const furnitureDepreciation = (year <= 10 && furnitureCost > 0) ? (furnitureCost / 10) : 0;

        // Renovation Deduction (Year 1 Immediate Write-off)
        const renovationDeduction = (year === 1 && renovationCost > 0) ? renovationCost : 0;

        const taxableIncome = noi - totalInterest - annualDepreciation - furnitureDepreciation - renovationDeduction;
        let taxPayable = 0;
        let taxSaved = 0;

        if (taxableIncome > 0) {
            taxPayable = taxableIncome * (taxRatePercent / 100);
        } else {
            // Negative taxable income reduces tax on other PERSONAL income
            taxSaved = Math.abs(taxableIncome) * (taxRatePercent / 100);
        }

        // D. Cash Flows
        const cfPreTax = noi - actualDebtService;
        const cfPostTax = cfPreTax - taxPayable + taxSaved; // Adding taxSaved as a "virtual inflow" or actual cash benefit if offset against wage tax

        cumulativeCashFlow += cfPostTax;
        cumulativeTaxSavings += taxSaved;

        // Update Balances
        currentBankBalance -= bankPrincipal;
        if (useKfwLoan) currentKfwBalance -= kfwPrincipal;
        currentTotalBalance = currentBankBalance + currentKfwBalance;

        // Record Year
        timeline.push({
            year,
            potentialRent,
            rentalIncome: effectiveGrossIncome,
            noi,
            opsCostVal,
            interestPayment: totalInterest,
            principalPayment: totalPrincipal,
            depreciation: annualDepreciation,
            taxableIncome,
            taxPayable,
            taxSaved,
            cfPreTax,
            cfPostTax,
            loanBalance: currentTotalBalance
        });

        // Apply Growth for Next Year
        currentMonthlyRent *= (1 + rentIncreasePercent / 100);
        currentOpCosts *= (1 + costIncreasePercent / 100);
        currentMgmtCosts *= (1 + costIncreasePercent / 100);
        currentMaint *= (1 + costIncreasePercent / 100);
    }

    // --- 3. Exit Analysis ---
    const projectedSalePrice = purchasePrice * Math.pow(1 + (propertyAppreciationPercent / 100), holdingPeriodYears);
    // Simplified selling costs
    const sellingCosts = 0;

    // Capital Gains Tax
    let exitTax = 0;
    if (holdingPeriodYears < 10 && capitalGainsTaxRate > 0) {
        // Taxable Gain = Sale Price - Book Value
        // Note: currentBookValue is the residual building value. Land value (purchasePrice - afaBaseValue) never depreciates?
        // Actually: Book Value = (Land + Residual Building + Non-Depreciated Costs). 
        // Simply: Original Cost - Accumulated Depreciation.
        // But currentBookValue only tracks the Building part.

        // Land Value Portion (assumed constant cost basis)
        const landValue = purchasePrice - afaBaseValue;
        const totalBookValue = landValue + currentBookValue + purchaseCosts; // Simplified cost basis

        const gain = projectedSalePrice - sellingCosts - totalBookValue;
        if (gain > 0) exitTax = gain * (capitalGainsTaxRate / 100);
    }

    const netExitProceeds = projectedSalePrice - sellingCosts - exitTax - currentTotalBalance;

    // "Wealth Accumulation (Steuerfrei)"
    // User image: Property Value - Remaining Debt.
    const wealthAccumulation = projectedSalePrice - currentTotalBalance;

    // "Exiterlös" (Total Benefit) = Wealth Accumulation + Taxes Saved (over holding period)
    const totalEconomicExit = wealthAccumulation + cumulativeTaxSavings;
    const exitPricePerSqm = sizeSqm > 0 ? projectedSalePrice / sizeSqm : 0;

    // --- 4. Return Metrics ---
    // IRR Stream
    const netCashAtExit = projectedSalePrice - sellingCosts - exitTax - currentTotalBalance;

    const irrStream = [-equityNow];
    timeline.forEach(t => irrStream.push(t.cfPostTax));
    irrStream[irrStream.length - 1] += netCashAtExit;

    const irr = calculateIRR(irrStream);

    const totalCashReturned = cumulativeCashFlow + netCashAtExit;
    const equityMultiple = equityNow > 0 ? totalCashReturned / equityNow : 0;

    // Stabilized Metrics (Average over holding period to avoid Year 1 distortion from subsidies/renovations)
    const avgCashFlowPostTax = timeline.reduce((sum, t) => sum + t.cfPostTax, 0) / holdingPeriodYears;
    const avgPrincipalPayment = timeline.reduce((sum, t) => sum + t.principalPayment, 0) / holdingPeriodYears;

    const cashOnCashAvg = equityNow > 0 ? (avgCashFlowPostTax / equityNow) * 100 : 0;
    const roeAvg = equityNow > 0 ? ((avgCashFlowPostTax + avgPrincipalPayment) / equityNow) * 100 : 0;

    // Year 1 Snapshots (for internal reference or specific displays)
    const y1 = timeline[0];
    const netYield = totalInvestment > 0 ? (y1.noi / totalInvestment) * 100 : 0;
    
    // ROI (Total): (Total Net Profit / Total Cash Invested) * 100
    const totalNetProfit = totalEconomicExit - equityNow;
    const roiTotal = equityNow > 0 ? (totalNetProfit / equityNow) * 100 : 0;

    // ROI (Annualized / CAGR): ((Total Wealth / Initial Equity) ^ (1/Years) - 1) * 100
    // This provides a comparable annual rate of return over the holding period.
    const roiAnnualized = (equityNow > 0 && holdingPeriodYears > 0)
        ? (Math.pow(totalEconomicExit / equityNow, 1 / holdingPeriodYears) - 1) * 100
        : 0;

    const totalDebtServiceY1 = y1.interestPayment + y1.principalPayment;
    const dscr = totalDebtServiceY1 > 0 ? y1.noi / totalDebtServiceY1 : (y1.noi > 0 ? Infinity : 0);


    const pricePerSqm = sizeSqm > 0 ? purchasePrice / sizeSqm : 0;

    // Calc total initial annuity for DSCR reference / Break Even
    // Bank Annuity
    const bankAnnuity = bankLoanAmount * ((interestRatePercent + repaymentRatePercent) / 100);
    // KFW Annuity (Assumed full payment or Interest only? For Break Even, we should assume the "Steady State" payment often, or just Year 1?)
    // Safe to use Year 1 payment context for Break Even Rent.
    const year1DebtService = y1.interestPayment + y1.principalPayment;

    // Mixed Interest Rate Calculation
    let mixedInterestRate = 0;
    if (useKfwLoan && totalLoanAmount > 0) {
        const bankShare = bankLoanAmount / totalLoanAmount;
        const kfwShare = kfwAmount / totalLoanAmount;
        mixedInterestRate = (bankShare * interestRatePercent) + (kfwShare * kfwInterestRate);
    }

    return {
        inputs,
        acquisition: {
            purchaseCosts,
            totalInvestment,
            equityNow,
            afaBaseValue,
            pricePerSqm
        },
        operations: {
            noi: y1.noi,
            netYield,
            grossYield: purchasePrice > 0 ? (y1.potentialRent / purchasePrice) * 100 : 0,
            ger: totalInvestment > 0 ? (y1.potentialRent / totalInvestment) * 100 : 0,
            expenseRatio: y1.rentalIncome > 0 ? (y1.opsCostVal / y1.rentalIncome) * 100 : 0
        },
        financing: {
            annuity: year1DebtService,
            initialDscr: dscr,
            loanAmountTotal: totalLoanAmount,
            loanAmountBank: bankLoanAmount,
            loanAmountKfw: useKfwLoan ? kfwAmount : 0,
            mixedInterestRate: mixedInterestRate // New metric
        },
        returnMetrics: {
            cashFlowPreTaxYear1: y1.cfPreTax,
            cashFlowPostTaxYear1: y1.cfPostTax,
            cashOnCashAvg: cashOnCashAvg,
            roeAvg: roeAvg,
            roiTotal: roiTotal,
            roiAnnualized: roiAnnualized,
            // Break Even Rent = Monthly Operating Costs + Monthly Debt Service
            breakEvenRentMonthly: inputs.operatingCostsMonthly + inputs.mgmtCostsMonthly + inputs.maintenanceReserveMonthly + (year1DebtService / 12),
            equityMultiple,
            irr,
            timeline
        },
        wealth: {
            propertyValueExit: projectedSalePrice,
            remainingDebtExit: currentTotalBalance,
            wealthAccumulation, // Value - Debt
            kfwSubsidyAmount,   // Explicitly returned
            cumulativeTaxSavings,
            totalEconomicExit, // Wealth + Tax Saved
            years: holdingPeriodYears,
            exitPricePerSqm
        }
    };
}
