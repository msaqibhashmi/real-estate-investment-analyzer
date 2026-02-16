/**
 * Simple Reactive State Management
 */

import { calculateMetrics } from './finance.js';

const INITIAL_STATE = {
    // Acquisition
    purchasePrice: 0,
    transferTaxPercent: 6,  // Grunderwerbsteuer (varies by Bundesland)
    notaryPercent: 2,    // Notar & Grundbuch
    brokerPercent: 0,     // Makler
    sizeSqm: 0,          // Property Size

    // Property Specs
    buildingSharePercent: 80, // Default for AfA Base

    // Operating
    monthlyColdRent: 0,
    vacancyRatePercent: 0,
    operatingCostsMonthly: 0,
    mgmtCostsMonthly: 0,
    maintenanceReserveMonthly: 0,

    // Growth
    rentIncreasePercent: 2,     // Annual rent dynamic
    costIncreasePercent: 0,     // Annual cost dynamic
    propertyAppreciationPercent: 2, // Annual value growth

    // Financing
    loanPercent: 100,
    interestRatePercent: 4.5,
    repaymentRatePercent: 1.5,
    loanTermYears: 10,

    // KFW 261 / QNG Split
    useKfwLoan: false,
    kfwLoanType: '261', // '261', 'qng40', 'standard'
    kfwLoanAmount: 100000,
    kfwInterestRate: 1.0,
    kfwRepaymentRate: 3.0, // Tilgung for KFW often effectively lower or customized
    kfwGracePeriod: 1,     // Tilgungsfreie Anlaufjahre (1-5)
    kfwTilgungszuschuss: 5.0, // Repayment Subsidy in %
    qng40AfaType: 'degressive', // 'degressive', 'linear'


    // Tax
    afaRatePercent: 2, // New residential standard
    taxRatePercent: 42,
    holdingPeriodYears: 10,
    capitalGainsTaxRate: 0,
    renovationCost: 0,
    furnitureCost: 0,

    // AfA Types
    isLinearAfa: true,
    useSpecialAfa: false,

    // Qualitative / Advisor
    locationType: 3, // 1: C-Location (Village), 3: B-Location (Suburbs), 5: A-Location (Top 7 City)
    conditionType: 3, // 1: Fixer-Upper, 3: Good/Standard, 5: New/Top
    marketPricing: 'fair' // 'under', 'fair', 'over'
};

class Store {
    constructor() {
        this.data = { ...INITIAL_STATE };
        this.listeners = [];
        this.scenarios = JSON.parse(localStorage.getItem('property_scenarios') || '[]');
        this.comparisonIds = [];
        this.currentScenarioId = null;
        this.metrics = calculateMetrics(this.data);
    }

    get() {
        return this.data;
    }

    getMetrics() {
        return this.metrics;
    }

    getScenarios() {
        return this.scenarios;
    }

    update(key, value, silent = false) {
        // Only convert to number if it's a numeric string and not a predefined string field
        const stringFields = ['marketPricing', 'kfwLoanType', 'qng40AfaType'];
        if (!stringFields.includes(key) && typeof value === 'string') {
            // Handle checkboxes/booleans
            if (value === 'true') value = true;
            else if (value === 'false') value = false;
            else value = parseFloat(value) || 0;
        }

        if (this.data[key] !== value) {
            this.data[key] = value;
            this.metrics = calculateMetrics(this.data);
            if (!silent) {
                this.notify();
            }
        }
    }

    // Scenario Management
    saveScenario(name = "New Property") {
        const newScenario = {
            id: Date.now().toString(),
            name: name,
            timestamp: new Date().toISOString(),
            data: JSON.parse(JSON.stringify(this.data)),
            metrics: JSON.parse(JSON.stringify(this.metrics))
        };
        this.scenarios.unshift(newScenario);
        this.currentScenarioId = newScenario.id; // Switch to new scenario
        this.persist();
        this.notify();
    }

    updateScenario(id) {
        const index = this.scenarios.findIndex(s => s.id === id);
        if (index !== -1) {
            this.scenarios[index].data = JSON.parse(JSON.stringify(this.data));
            this.scenarios[index].metrics = JSON.parse(JSON.stringify(this.metrics));
            this.scenarios[index].timestamp = new Date().toISOString();
            this.persist();
            this.notify();
        }
    }

    reorderScenario(fromId, toId) {
        const fromIndex = this.scenarios.findIndex(s => s.id === fromId);
        const toIndex = this.scenarios.findIndex(s => s.id === toId);

        if (fromIndex !== -1 && toIndex !== -1 && fromIndex !== toIndex) {
            const [movedItem] = this.scenarios.splice(fromIndex, 1);
            this.scenarios.splice(toIndex, 0, movedItem);
            this.persist();
            this.notify();
        }
    }

    deleteScenario(id) {
        this.scenarios = this.scenarios.filter(s => s.id !== id);
        this.comparisonIds = this.comparisonIds.filter(cid => cid !== id);
        if (this.currentScenarioId === id) this.currentScenarioId = null;
        this.persist();
        this.notify();
    }

    loadScenario(id) {
        const scenario = this.scenarios.find(s => s.id === id);
        if (scenario) {
            // Merge with INITIAL_STATE to ensure new feature fields are present even in old scenarios
            this.data = { ...INITIAL_STATE, ...JSON.parse(JSON.stringify(scenario.data)) };
            this.metrics = calculateMetrics(this.data);
            this.currentScenarioId = id;
            this.notify();
        }
    }

    toggleComparison(id) {
        if (this.comparisonIds.includes(id)) {
            this.comparisonIds = this.comparisonIds.filter(cid => cid !== id);
        } else {
            this.comparisonIds.push(id);
        }
        this.notify();
    }

    getComparisonMetrics() {
        return this.scenarios.filter(s => this.comparisonIds.includes(s.id));
    }

    persist() {
        localStorage.setItem('property_scenarios', JSON.stringify(this.scenarios));
    }

    subscribe(callback) {
        this.listeners.push(callback);
        // Initial call
        callback(this.data, this.metrics);
    }

    notify() {
        this.listeners.forEach(cb => cb(this.data, this.metrics));
    }
}

export const store = new Store();
