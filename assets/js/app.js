import { store } from './state.js';
import { analyzeProperty, compareProperties } from './advisor.js';

// Formatters
const fmtCurrency = new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 });

const fmtPercent = new Intl.NumberFormat('de-DE', { style: 'percent', minimumFractionDigits: 1, maximumFractionDigits: 2 });

// View State
let viewMode = 'monthly'; // 'yearly' or 'monthly'

const setText = (id, val) => {
    const el = document.getElementById(id);
    if (el) el.textContent = val;
};

function bindInputs() {
    // Select all inputs AND selects with data-model
    const inputs = document.querySelectorAll('[data-model]');

    // Set initial values
    const state = store.get();
    inputs.forEach(input => {
        const key = input.dataset.model;
        if (state[key] !== undefined) {
            if (input.type === 'checkbox') {
                input.checked = state[key];
            } else {
                input.value = state[key];
            }
        }

        // Listen for changes
        // Use 'change' for select and checkbox, 'input' for text/number (but 'change' works for all for data model updates usually, though 'input' is smoother for sliders/text)
        const eventType = (input.tagName === 'SELECT' || input.type === 'checkbox') ? 'change' : 'input';

        input.addEventListener(eventType, (e) => {
            const val = input.type === 'checkbox' ? e.target.checked : e.target.value;

            // Debugging
            // console.log(`Input Changed: ${key} -> ${val}`);

            store.update(key, val);

            // UI Side Effect for KFW Toggle
            // Note: We moved the specific dropdown logic to a separate listener below to avoid race conditions
            if (key === 'useKfwLoan' || key === 'kfwLoanType') {
                const state = store.get();
                // If QNG 40 is selected, set defaults for AfA
                if (state.useKfwLoan && state.kfwLoanType === 'qng40') {
                    store.update('isLinearAfa', false, true); // Degressive
                    store.update('useSpecialAfa', true, true); // 5% Special AfA
                    store.update('afaRatePercent', 5.0, true); // Default degressive rate
                }
                updateKfwUI(store.get());
                updateSpecialAfaUI(store.get());
                updateAfaRateUI(store.get());
                updateInputs(store.get());
            }
        });
    });

    // Button Toggle Logic for KFW
    const btnToggleKfw = document.getElementById('btn-toggle-kfw');
    const chkKfw = document.getElementById('chk-kfw');
    if (btnToggleKfw && chkKfw) {
        btnToggleKfw.addEventListener('click', (e) => {
            e.preventDefault();
            // Toggle the checkbox state
            chkKfw.checked = !chkKfw.checked;
            // Update store directly
            store.update('useKfwLoan', chkKfw.checked);
            // Update UI
            updateKfwUI(store.get());
        });
    }

    // Initial UI State check
    updateKfwUI(state);
}

function updateKfwUI(state) {
    const show = state.useKfwLoan;
    const type = state.kfwLoanType;

    // Toggle Container & Button Text
    const container = document.getElementById('kfw-container');
    const btnText = document.getElementById('kfw-status-text');
    const btn = document.getElementById('btn-toggle-kfw');

    if (container) container.style.display = show ? 'block' : 'none';

    if (btnText) btnText.textContent = show ? 'Remove' : 'Add Secondary Loan';
    if (btn) {
        // Toggle visual style
        if (show) {
            btn.classList.remove('btn-secondary');
            btn.classList.add('btn-danger');
            btn.style.opacity = '0.9';
        } else {
            btn.classList.add('btn-secondary');
            btn.classList.remove('btn-danger');
            btn.style.opacity = '1';
        }
    }

    // Ensure Dropdown Value Visual Sync
    const typeSelect = document.getElementById('kfw-loan-type');
    if (typeSelect && show) {
        if (typeSelect.value !== type) {
            typeSelect.value = type;
        }
    }

    // Type Specific Visibility
    const subsidyGroup = document.getElementById('kfw-subsidy-group');
    if (subsidyGroup) {
        subsidyGroup.style.display = (type === 'qng40') ? 'none' : 'block';
    }

    // --- AfA Controls Visibility ---
    const isQng40 = show && type === 'qng40';
    const afaTypeContainer = document.getElementById('afa-type-toggle-container');
    const specialAfaContainer = document.getElementById('special-afa-checkbox-container');
    const afaInput = document.getElementById('afa-rate-input');

    if (afaTypeContainer && specialAfaContainer && afaInput) {
        afaTypeContainer.style.display = isQng40 ? 'flex' : 'none';
        specialAfaContainer.style.display = isQng40 ? 'flex' : 'none';
        // afaInput.disabled = isQng40; // User wants input active in all modes
    }
}

function updateSpecialAfaUI(state) {
    const badge = document.getElementById('badge-special-afa');
    const dot = badge?.querySelector('.badge-dot');
    if (badge && dot) {
        if (state.useSpecialAfa) {
            badge.style.borderColor = 'var(--accent-primary)';
            badge.style.color = 'var(--accent-primary)';
            badge.style.background = 'rgba(16, 185, 129, 0.1)';
            dot.style.background = 'var(--accent-primary)';
        } else {
            badge.style.borderColor = 'var(--border)';
            badge.style.color = 'var(--text-secondary)';
            badge.style.background = 'transparent';
            dot.style.background = 'var(--border)';
        }
    }
}

function bindSpecialAfaBadge() {
    const badge = document.getElementById('badge-special-afa');
    const chk = document.getElementById('chk-special-afa');
    if (badge && chk) {
        badge.addEventListener('click', () => {
            const newState = !chk.checked;
            chk.checked = newState;
            store.update('useSpecialAfa', newState);
            updateSpecialAfaUI(store.get());
        });
    }
}

function updateAfaRateUI(state) {
    const isLinear = state.isLinearAfa;
    const btnDeg = document.getElementById('btn-afa-yearly');
    const btnLin = document.getElementById('btn-afa-monthly');
    
    if (btnDeg && btnLin) {
        if (isLinear) {
            btnLin.classList.add('active');
            btnDeg.classList.remove('active');
        } else {
            btnDeg.classList.add('active');
            btnLin.classList.remove('active');
        }
    }
}


function bindAfaControls() {
    const btnDeg = document.getElementById('btn-afa-yearly');
    const btnLin = document.getElementById('btn-afa-monthly');
    const chkToggle = document.getElementById('afa-type-toggle');

    if (btnDeg && btnLin && chkToggle) {
        btnDeg.addEventListener('click', () => {
            store.update('isLinearAfa', false);
            store.update('afaRatePercent', 5.0);
            updateAfaRateUI(store.get());
        });
        btnLin.addEventListener('click', () => {
            store.update('isLinearAfa', true);
            store.update('afaRatePercent', 3.0);
            updateAfaRateUI(store.get());
        });
    }
}

function updateDashboard(data, metrics) {
    // 1. Core KPIs
    document.getElementById('disp-equity').textContent = fmtCurrency.format(metrics.acquisition.equityNow);
    document.getElementById('disp-total-invest').textContent = fmtCurrency.format(metrics.acquisition.totalInvestment);
    document.getElementById('disp-price-sqm').textContent = fmtCurrency.format(metrics.acquisition.pricePerSqm);

    const yieldVal = metrics.operations.netYield;
    const elYield = document.getElementById('disp-yield');
    elYield.textContent = fmtPercent.format(yieldVal / 100);

    // Yield Color Logic: >=5% Emerald, >=3.5% Amber, <3.5% Red
    if (yieldVal >= 5) elYield.style.color = 'var(--success)';
    else if (yieldVal >= 3.5) elYield.style.color = 'var(--warning)';
    else elYield.style.color = 'var(--danger)';

    const elGross = document.getElementById('disp-gross-yield');
    if (elGross) {
        const grossVal = metrics.operations.grossYield;
        elGross.textContent = fmtPercent.format(grossVal / 100);
        // Target: > 6% success, > 4% warning, else danger
        if (grossVal >= 6) elGross.style.color = 'var(--success)';
        else if (grossVal >= 4) elGross.style.color = 'var(--warning)';
        else elGross.style.color = 'var(--danger)';
    }

    const elExpRatio = document.getElementById('disp-expense-ratio');
    if (elExpRatio) {
        const expRatio = metrics.operations.expenseRatio;
        elExpRatio.textContent = fmtPercent.format(expRatio / 100);
        // Target: < 20% success, < 35% warning, else danger (lower is better)
        if (expRatio <= 20) elExpRatio.style.color = 'var(--success)';
        else if (expRatio <= 35) elExpRatio.style.color = 'var(--warning)';
        else elExpRatio.style.color = 'var(--danger)';
    }

    // Cash-on-Cash (Primary - Average)
    const coc = metrics.returnMetrics.cashOnCashAvg;
    const elCoc = document.getElementById('disp-coc');
    elCoc.textContent = fmtPercent.format(coc / 100);

    // Target logic: >= 8% is success, >= 3% is warning, < 3% is danger
    if (coc >= 8) elCoc.style.color = 'var(--success)';
    else if (coc >= 3) elCoc.style.color = 'var(--warning)';
    else elCoc.style.color = 'var(--danger)';

    const roe = metrics.returnMetrics.roeAvg;
    const elRoe = document.getElementById('disp-roe');
    elRoe.textContent = fmtPercent.format(roe / 100);
    if (roe >= 12) elRoe.style.color = 'var(--success)';
    else if (roe >= 6) elRoe.style.color = 'var(--warning)';
    else elRoe.style.color = 'var(--danger)';

    const roi = metrics.returnMetrics.roiAnnualized;
    const elRoi = document.getElementById('disp-roi');
    if (elRoi) {
        elRoi.textContent = fmtPercent.format(roi / 100);
        if (roi >= 15) elRoi.style.color = 'var(--success)';
        else if (roi >= 8) elRoi.style.color = 'var(--warning)';
        else elRoi.style.color = 'var(--danger)';
    }

    // IRR
    const irr = metrics.returnMetrics.irr;
    const elIrr = document.getElementById('disp-irr');
    elIrr.textContent = irr !== null ? fmtPercent.format(irr / 100) : 'N/A';
    if (irr === null) {
        elIrr.style.color = 'var(--text-secondary)';
    } else if (irr >= 10) {
        elIrr.style.color = 'var(--success)';
    } else if (irr >= 5) {
        elIrr.style.color = 'var(--warning)';
    } else {
        elIrr.style.color = 'var(--danger)';
    }

    const moic = metrics.returnMetrics.equityMultiple;
    const elMoic = document.getElementById('disp-moic');
    elMoic.textContent = moic.toFixed(2) + 'x';
    if (moic >= 2.5) elMoic.style.color = 'var(--success)';
    else if (moic >= 1.8) elMoic.style.color = 'var(--warning)';
    else elMoic.style.color = 'var(--danger)';

    // 2. Wealth Accumulation (New Section)
    const w = metrics.wealth;
    document.getElementById('disp-years').textContent = w.years;
    document.getElementById('disp-exit-value').textContent = fmtCurrency.format(w.propertyValueExit);
    document.getElementById('disp-exit-price-sqm').textContent = `${fmtCurrency.format(w.exitPricePerSqm)}/m²`;
    document.getElementById('disp-exit-debt').textContent = fmtCurrency.format(w.remainingDebtExit);

    document.getElementById('disp-wealth-accum').textContent = fmtCurrency.format(w.wealthAccumulation);
    document.getElementById('disp-wealth-appreciation').textContent = fmtCurrency.format(w.appreciationTotal);
    document.getElementById('disp-wealth-repayment').textContent = fmtCurrency.format(w.repaymentTotal);

    const taxSavedEl = document.getElementById('disp-tax-saved');
    taxSavedEl.textContent = fmtCurrency.format(w.cumulativeTaxSavings);
    taxSavedEl.style.color = w.cumulativeTaxSavings > 0 ? 'var(--success)' : 'var(--text-secondary)';

    document.getElementById('disp-total-benefit').textContent = fmtCurrency.format(w.totalEconomicExit);

    // Financing
    setText('debt-service-val', fmtCurrency.format(metrics.financing.annuity / 12));
    const dscr = metrics.financing.initialDscr;
    if (isFinite(dscr)) {
        setText('disp-dscr', dscr.toFixed(2));
    } else {
        setText('disp-dscr', 'N/A');
    }

    // GER Display & Color Logic
    const ger = metrics.operations.ger;
    const elGer = document.getElementById('disp-ger');
    if (elGer) {
        elGer.textContent = fmtPercent.format(ger / 100);
        // Target: > 6% success, > 4% warning, else danger
        if (ger >= 6) elGer.style.color = 'var(--success)';
        else if (ger >= 4) elGer.style.color = 'var(--warning)';
        else elGer.style.color = 'var(--danger)';
    }

    // 3. Risk (DSCR color logic)
    const elDscr = document.getElementById('disp-dscr');
    if (elDscr) {
        if (!isFinite(dscr)) {
            elDscr.style.color = 'var(--text-secondary)';
        } else {
            if (dscr < 1.0) elDscr.style.color = 'var(--danger)';
            else if (dscr < 1.2) elDscr.style.color = 'var(--warning)';
            else elDscr.style.color = 'var(--success)';
        }
    }

    // Mixed Rate Display
    const mixedRateEl = document.getElementById('mixed-rate-display');
    if (mixedRateEl) {
        if (data.useKfwLoan) {
            mixedRateEl.style.display = 'block';
            mixedRateEl.querySelector('span').textContent = metrics.financing.mixedInterestRate.toFixed(2) + '%';
        } else {
            mixedRateEl.style.display = 'none';
        }
    }


    // Break-even
    document.getElementById('disp-break-even').textContent = fmtCurrency.format(metrics.returnMetrics.breakEvenRentMonthly);
    document.getElementById('disp-rent').textContent = fmtCurrency.format(data.monthlyColdRent);

    // Rent per sqm
    const size = data.sizeSqm || 1;
    document.getElementById('disp-rent-sqm').textContent = (data.monthlyColdRent / size).toLocaleString('de-DE', { style: 'currency', currency: 'EUR', minimumFractionDigits: 2 });




    // 4. Render Timeline with current viewMode
    renderTimeline(metrics.returnMetrics.timeline);

    // 5. Scenario Management
    renderScenarios();
    renderComparison();
}

// Update input values from state (e.g. after loading scenario)
function updateInputs(state) {
    const inputs = document.querySelectorAll('[data-model]'); // Changed to select all model elements
    inputs.forEach(input => {
        const key = input.dataset.model;
        if (state[key] !== undefined) {
            // Only update if value is different to avoid cursor jumping
            if (input.type === 'checkbox') {
                input.checked = state[key];
            } else {
                // For select, .value works the same
                if (input.value != state[key]) {
                    input.value = state[key];
                }
            }
        }
    });
}

function renderScenarios() {
    const list = document.getElementById('scenario-list');
    if (!list) return;

    const scenarios = store.getScenarios();
    const comparisonIds = store.comparisonIds;
    const currentId = store.currentScenarioId;

    // Update Sidebar Action Button
    const btnSidebarAction = document.getElementById('btn-sidebar-save');
    if (btnSidebarAction) {
        btnSidebarAction.textContent = currentId ? 'Update Search' : 'Save Search';
        if (currentId) {
            btnSidebarAction.classList.remove('btn-primary');
            btnSidebarAction.classList.add('btn-warning');
            btnSidebarAction.style.color = '#0f172a';
        } else {
            btnSidebarAction.classList.remove('btn-warning');
            btnSidebarAction.classList.add('btn-primary');
            btnSidebarAction.style.color = '#fff';
        }
    }

    if (scenarios.length === 0) {
        list.innerHTML = '<div class="text-muted" style="font-size: 0.8rem; text-align: center; padding: 10px;">No saved scenarios yet.</div>';
        return;
    }

    list.innerHTML = scenarios.map(s => `
        <div class="scenario-item ${comparisonIds.includes(s.id) ? 'active' : ''}" 
             style="${s.id === currentId ? 'border-left: 3px solid var(--warning);' : ''}"
             draggable="true"
             data-id="${s.id}"
             ondragstart="window.dragStart(event)"
             ondragover="window.dragOver(event)"
             ondrop="window.drop(event)"
             ondragenter="window.dragEnter(event)"
             ondragleave="window.dragLeave(event)">
            <div class="scenario-info">
                <div class="scenario-name" style="font-weight: ${s.id === currentId ? '700' : '400'}">
                    <span style="cursor: move; margin-right: 6px; color: var(--text-secondary);">⋮⋮</span>
                    ${s.name} ${s.id === currentId ? '<span style="font-size:0.7em; color:var(--warning);">(Active)</span>' : ''}
                </div>
                <div style="display: flex; gap: 4px;">
                     <button class="btn btn-secondary" style="padding: 4px; line-height: 0; background-color: transparent; color: var(--text-primary); border: 1px solid var(--border);" onclick="window.loadScenario('${s.id}')" title="Edit">
                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                     </button>
                     <button class="btn btn-danger" style="padding: 4px; line-height: 0;" onclick="window.deleteScenario('${s.id}')" title="Delete">
                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>
                     </button>
                </div>
            </div>
            <div class="scenario-actions">
                <span class="scenario-date">${new Date(s.timestamp).toLocaleDateString()}</span>
                <label class="compare-checkbox">
                    <input type="checkbox" ${comparisonIds.includes(s.id) ? 'checked' : ''} onchange="window.toggleComparison('${s.id}')"> Compare
                </label>
            </div>
        </div>
    `).join('');
}

// Drag and Drop Handlers
window.dragStart = (e) => {
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', e.target.dataset.id);
    e.target.classList.add('dragging');
}

window.dragOver = (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
}

window.dragEnter = (e) => {
    e.preventDefault();
    const item = e.target.closest('.scenario-item');
    if (item && !item.classList.contains('dragging')) {
        item.classList.add('drag-over');
    }
}

window.dragLeave = (e) => {
    const item = e.target.closest('.scenario-item');
    if (item) {
        item.classList.remove('drag-over');
    }
}

window.drop = (e) => {
    e.preventDefault();
    const draggedId = e.dataTransfer.getData('text/plain');
    const targetItem = e.target.closest('.scenario-item');

    // Cleanup
    document.querySelectorAll('.scenario-item').forEach(el => {
        el.classList.remove('dragging');
        el.classList.remove('drag-over');
    });

    if (targetItem) {
        const targetId = targetItem.dataset.id;
        if (draggedId && targetId && draggedId !== targetId) {
            store.reorderScenario(draggedId, targetId);
        }
    }
}

function renderComparison() {
    const tableContainer = document.querySelector('.comparison-container');
    const emptyState = document.getElementById('comparison-empty-state');
    const head = document.getElementById('comparison-head');
    const body = document.getElementById('comparison-body');

    if (!head || !body || !tableContainer || !emptyState) return;

    const items = store.getComparisonMetrics();

    if (items.length === 0) {
        tableContainer.style.display = 'none';
        emptyState.style.display = 'block';
        return;
    }

    tableContainer.style.display = 'block';
    emptyState.style.display = 'none';

    // Calculate Advisor Scores and Comparative Analysis
    const advisorResults = items.map(item => analyzeProperty(item.data, item.metrics));
    const comparison = items.length >= 2 ? compareProperties(items) : null;

    // Headers with enhanced scoring
    head.innerHTML = `<tr>
        <th style="width: 220px; text-align: left; padding: 20px; position: sticky; top: 0; background: var(--bg-primary); z-index: 100; box-shadow: 0 2px 8px rgba(0,0,0,0.15);">Metric</th>
        ${items.map((s, i) => `
            <th style="text-align: center; padding: 20px; border-left: 1px solid var(--border); position: sticky; top: 0; background: var(--bg-primary); z-index: 100; box-shadow: 0 2px 8px rgba(0,0,0,0.15);">
                <div style="font-size: 1.1rem; color: var(--text-primary); margin-bottom: 8px; font-weight: 600;">${s.name}</div>
                <div style="display: flex; align-items: center; justify-content: center; gap: 8px; flex-wrap: wrap;">
                     <div style="font-size: 0.85rem; padding: 4px 12px; border-radius: 12px; background: ${advisorResults[i].score >= 70 ? 'rgba(16, 185, 129, 0.2)' : advisorResults[i].score >= 55 ? 'rgba(251, 191, 36, 0.2)' : 'rgba(239, 68, 68, 0.2)'}; color: ${advisorResults[i].score >= 70 ? 'var(--accent-primary)' : advisorResults[i].score >= 55 ? '#fbbf24' : '#ef4444'}; font-weight: 600;">
                        ${advisorResults[i].score}/100
                    </div>
                </div>
                <div style="margin-top: 6px; display: flex; gap: 4px; flex-wrap: wrap; justify-content: center;">
                    ${advisorResults[i].tags.map(t => `<span style="font-size: 0.7rem; padding: 2px 6px; background: rgba(255,255,255,0.05); border-radius: 3px; color: var(--text-secondary);">${t}</span>`).join('')}
                </div>
            </th>
        `).join('')}
    </tr>`;

    // Initialize verdict HTML for winner recommendation and decision matrix
    let verdictHtml = '';

    // Add Winner Recommendation (if available)
    if (comparison && comparison.recommendation) {
        const rec = comparison.recommendation;
        verdictHtml += `
            <tr style="background: linear-gradient(135deg, rgba(16, 185, 129, 0.08) 0%, rgba(16, 185, 129, 0.02) 100%); border-top: 2px solid var(--accent-primary);">
                <td style="color: var(--accent-primary); font-weight: 700; padding: 20px; vertical-align: top; font-size: 1.05rem;">
                    ${rec.headline}
                </td>
                <td colspan="${items.length}" style="padding: 20px; border-left: 1px solid var(--border);">
                    <div style="margin-bottom: 12px;">
                        <div style="font-size: 1.1rem; font-weight: 700; color: var(--text-primary); margin-bottom: 8px;">
                            ${rec.winnerName}
                        </div>
                        <div style="font-size: 0.9rem; color: var(--text-secondary); margin-bottom: 12px;">
                            Based on risk-adjusted returns (IRR 40%, DSCR 30%, Cash-on-Cash 20%, Equity Multiple 10%)
                        </div>
                    </div>
                    ${rec.reasons.length > 0 ? `
                        <div style="margin-bottom: 12px;">
                            <div style="font-weight: 600; font-size: 0.85rem; color: var(--accent-primary); margin-bottom: 6px; text-transform: uppercase; letter-spacing: 0.05em;">Why This Property:</div>
                            ${rec.reasons.map(reason => `
                                <div style="padding: 6px 12px; margin: 4px 0; background: rgba(16, 185, 129, 0.1); border-left: 3px solid var(--accent-primary); border-radius: 3px; font-size: 0.9rem; color: var(--text-primary);">
                                    ✓ ${reason}
                                </div>
                            `).join('')}
                        </div>
                    ` : ''}
                    ${rec.tradeoffs.length > 0 ? `
                        <div>
                            <div style="font-weight: 600; font-size: 0.85rem; color: #fbbf24; margin-bottom: 6px; text-transform: uppercase; letter-spacing: 0.05em;">Trade-offs:</div>
                            ${rec.tradeoffs.map(tradeoff => `
                                <div style="padding: 6px 12px; margin: 4px 0; background: rgba(251, 191, 36, 0.08); border-left: 3px solid #fbbf24; border-radius: 3px; font-size: 0.85rem; color: var(--text-secondary);">
                                    ⚠ ${tradeoff}
                                </div>
                            `).join('')}
                        </div>
                    ` : ''}
                </td>
            </tr>
        `;
    }

    // Add Decision Matrix (Best in Category)
    if (comparison) {
        verdictHtml += `
            <tr style="background: rgba(255,255,255,0.01);">
                <td style="color: var(--text-secondary); font-weight: 600; padding: 20px; vertical-align: top;">
                    📊 Decision Matrix
                </td>
                <td colspan="${items.length}" style="padding: 20px; border-left: 1px solid var(--border);">
                    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 12px;">
                        <div style="padding: 12px; background: rgba(16, 185, 129, 0.05); border-radius: 6px; border: 1px solid rgba(16, 185, 129, 0.2);">
                            <div style="font-size: 0.75rem; color: var(--text-secondary); margin-bottom: 4px; text-transform: uppercase; letter-spacing: 0.05em;">Best Long-Term</div>
                            <div style="font-weight: 600; color: var(--accent-primary);">${items[comparison.bestIRR].name}</div>
                            <div style="font-size: 0.85rem; color: var(--text-secondary); margin-top: 2px;">${comparison.analyses[comparison.bestIRR].details.irr.toFixed(1)}% IRR</div>
                        </div>
                        <div style="padding: 12px; background: rgba(16, 185, 129, 0.05); border-radius: 6px; border: 1px solid rgba(16, 185, 129, 0.2);">
                            <div style="font-size: 0.75rem; color: var(--text-secondary); margin-bottom: 4px; text-transform: uppercase; letter-spacing: 0.05em;">Best Cash Flow</div>
                            <div style="font-weight: 600; color: var(--accent-primary);">${items[comparison.bestCashFlow].name}</div>
                            <div style="font-size: 0.85rem; color: var(--text-secondary); margin-top: 2px;">${comparison.analyses[comparison.bestCashFlow].details.coc.toFixed(1)}% CoC</div>
                        </div>
                        <div style="padding: 12px; background: rgba(16, 185, 129, 0.05); border-radius: 6px; border: 1px solid rgba(16, 185, 129, 0.2);">
                            <div style="font-size: 0.75rem; color: var(--text-secondary); margin-bottom: 4px; text-transform: uppercase; letter-spacing: 0.05em;">Lowest Risk</div>
                            <div style="font-weight: 600; color: var(--accent-primary);">${items[comparison.bestRisk].name}</div>
                            <div style="font-size: 0.85rem; color: var(--text-secondary); margin-top: 2px;">DSCR ${comparison.analyses[comparison.bestRisk].details.dscr.toFixed(2)}</div>
                        </div>
                        <div style="padding: 12px; background: rgba(16, 185, 129, 0.05); border-radius: 6px; border: 1px solid rgba(16, 185, 129, 0.2);">
                            <div style="font-size: 0.75rem; color: var(--text-secondary); margin-bottom: 4px; text-transform: uppercase; letter-spacing: 0.05em;">Least Capital</div>
                            <div style="font-weight: 600; color: var(--accent-primary);">${items[comparison.lowestEquity].name}</div>
                            <div style="font-size: 0.85rem; color: var(--text-secondary); margin-top: 2px;">${fmtCurrency.format(comparison.analyses[comparison.lowestEquity].details.equity)}</div>
                        </div>
                    </div>
                </td>
            </tr>
        `;
    }

    // Add comparative insights row if comparing 2 properties
    if (comparison && comparison.comparativeInsights && comparison.comparativeInsights.length > 0) {
        verdictHtml += `
            <tr style="background: rgba(251, 191, 36, 0.05);">
                <td style="color: #fbbf24; font-weight: 600; padding: 20px; vertical-align: top;">
                    ⚖️ Head-to-Head
                </td>
                <td colspan="${items.length}" style="padding: 20px; border-left: 1px solid var(--border);">
                    <div style="display: flex; gap: 16px; flex-wrap: wrap;">
                        ${comparison.comparativeInsights.map(insight => {
            if (insight.type === 'tradeoff') {
                return `<div style="flex: 1; min-width: 250px; padding: 12px; background: rgba(255,255,255,0.03); border-radius: 6px; border: 1px solid rgba(251, 191, 36, 0.3);">
                                    <div style="font-size: 0.9rem; color: var(--text-primary); line-height: 1.5;">${insight.message}</div>
                                </div>`;
            } else {
                return `<div style="padding: 8px 12px; background: rgba(16, 185, 129, 0.1); border-radius: 6px; font-size: 0.85rem; color: var(--accent-primary);">
                                    <strong>Property ${insight.winner + 1}:</strong> ${insight.message}
                                </div>`;
            }
        }).join('')}
                    </div>
                </td>
            </tr>
        `;
    }


    const sections = [
        {
            title: '🛡️ Risk Assessment (Deal Breakers)',
            rows: [
                { label: 'DSCR (Debt Coverage)', key: 'initialDscr', path: 'financing', type: 'number', higherIsBetter: true },
                { label: 'Break-even Rent', key: 'breakEvenRentMonthly', path: 'returnMetrics', higherIsBetter: false },
                { label: 'Equity Required', key: 'equityNow', path: 'acquisition', higherIsBetter: false }
            ]
        },
        {
            title: '📈 Return Metrics (Performance)',
            rows: [
                { label: 'IRR (Long-Term)', key: 'irr', path: 'returnMetrics', type: 'percent', higherIsBetter: true },
                { label: 'Cash-on-Cash (Avg)', key: 'cashOnCashAvg', path: 'returnMetrics', type: 'percent', higherIsBetter: true },
                { label: 'ROI (Annualized)', key: 'roiAnnualized', path: 'returnMetrics', type: 'percent', higherIsBetter: true },
                { label: 'ROI (Total)', key: 'roiTotal', path: 'returnMetrics', type: 'percent', higherIsBetter: true },
                { label: 'Equity Multiple', key: 'equityMultiple', path: 'returnMetrics', type: 'number', higherIsBetter: true },
                { label: 'ROE (Avg)', key: 'roeAvg', path: 'returnMetrics', type: 'percent', higherIsBetter: true }
            ]
        },
        {
            title: '🏘️ Market Positioning',
            rows: [
                { label: 'Net Yield (Unleveraged)', key: 'netYield', path: 'operations', type: 'percent', higherIsBetter: true },
                { label: 'Purchase Price', key: 'purchasePrice', path: 'inputs', higherIsBetter: false },
                { label: 'Wealth at Exit', key: 'wealthAccumulation', path: 'wealth', higherIsBetter: true }
            ]
        }
    ];

    let metricsHtml = '';

    sections.forEach(section => {
        // Section Header Row
        metricsHtml += `
            <tr style="background: rgba(255,255,255,0.02);">
                <th colspan="${items.length + 1}" style="padding: 12px 20px; font-weight: 700; font-size: 0.8rem; text-transform: uppercase; letter-spacing: 0.05em; color: var(--text-secondary);">
                    ${section.title}
                </th>
            </tr>
        `;

        section.rows.forEach(row => {
            // Find best and worst values
            const values = items.map(s => s.metrics[row.path][row.key]);
            const bestIdx = row.higherIsBetter
                ? values.indexOf(Math.max(...values))
                : values.indexOf(Math.min(...values));
            const worstIdx = row.higherIsBetter
                ? values.indexOf(Math.min(...values))
                : values.indexOf(Math.max(...values));

            metricsHtml += `<tr>
                <td style="color: var(--text-secondary); padding: 16px 20px;">${row.label}</td>
                ${items.map((s, idx) => {
                const val = s.metrics[row.path][row.key];
                let display = '';
                if (row.type === 'percent') display = fmtPercent.format(val / 100);
                else if (row.type === 'number') display = val?.toFixed(2) || '0';
                else display = fmtCurrency.format(val);

                // Determine if this is best/worst
                const isBest = idx === bestIdx && items.length > 1;
                const isWorst = idx === worstIdx && items.length > 1 && bestIdx !== worstIdx;

                let cellStyle = 'text-align: center; padding: 16px 20px; border-left: 1px solid var(--border); font-weight: 500; color: var(--text-primary);';
                if (isBest) {
                    cellStyle += ' background: rgba(16, 185, 129, 0.08); position: relative;';
                } else if (isWorst) {
                    cellStyle += ' background: rgba(239, 68, 68, 0.05);';
                }

                let deltaHtml = '';
                if (idx > 0) {
                    const baseVal = items[0].metrics[row.path][row.key];
                    const diff = val - baseVal;
                    if (Math.abs(diff) > 0.01) {
                        const isGood = row.higherIsBetter ? diff > 0 : diff < 0;
                        const diffColor = isGood ? 'var(--accent-primary)' : '#ef4444';
                        const diffSign = diff > 0 ? '+' : '';
                        const diffValue = row.type === 'percent' ? `${diffSign}${diff.toFixed(1)}%` : fmtCurrency.format(diff);
                        deltaHtml = `<div style="margin-top: 4px; font-size: 0.75rem; font-weight: 600; color: ${diffColor};">${diffSign}${diffValue}</div>`;
                    }
                }

                let badge = '';
                if (isBest) {
                    badge = '<div style="position: absolute; top: 4px; right: 4px; background: var(--accent-primary); color: var(--bg-primary); font-size: 0.65rem; padding: 2px 6px; border-radius: 3px; font-weight: 700;">BEST</div>';
                }

                return `<td style="${cellStyle}">
                        ${badge}
                        <div style="font-size: 1rem;">${display}</div>
                        ${deltaHtml}
                    </td>`;
            }).join('')}
            </tr>`;
        });
    });

    body.innerHTML = verdictHtml + metricsHtml;
}

// Global Handlers (for onclick/onchange in template literals)
window.loadScenario = (id) => {
    store.loadScenario(id);
    // Close drawer on load
    document.getElementById('btn-close-portfolio')?.click();
};
window.deleteScenario = (id) => store.deleteScenario(id);
window.toggleComparison = (id) => {
    store.toggleComparison(id);
    const items = store.getComparisonMetrics();
    // If we just added a second item, auto-jump to comparison
    if (items.length >= 2 && store.comparisonIds.includes(id)) {
        switchTab('comparison');
    }
};

function renderTimeline(timelineData) {
    const tbody = document.getElementById('timeline-body');
    if (!tbody) return;
    tbody.innerHTML = '';

    const divider = viewMode === 'monthly' ? 12 : 1;

    timelineData.forEach(row => {
        const tr = document.createElement('tr');

        // Tax Display Logic
        let taxDisplay = '';
        if (row.taxPayable > 0) {
            taxDisplay = `<span style="color: var(--danger)">-${fmtCurrency.format(row.taxPayable / divider)}</span>`;
        } else if (row.taxSaved > 0) {
            taxDisplay = `<span style="color: var(--success)">+${fmtCurrency.format(row.taxSaved / divider)}</span>`;
        } else {
            taxDisplay = `€0`;
        }

        const subsidyDisplay = row.kfwSubsidy > 0
            ? `<div style="font-size: 0.7rem; color: var(--accent-primary); font-weight: 600;">-${fmtCurrency.format(row.kfwSubsidy)}</div>`
            : '';

        tr.innerHTML = `
            <td>${row.year}</td>
            <td class="text-right">${fmtCurrency.format(row.rentalIncome / divider)}</td>
            <td class="text-right">${fmtCurrency.format(row.opsCostVal / divider)}</td>
            <td class="text-right">${fmtCurrency.format(row.interestPayment / divider)}</td>
            <td class="text-right">${fmtCurrency.format(row.principalPayment / divider)}</td>
            <td class="text-right">${fmtCurrency.format(row.cfPreTax / divider)}</td>
            <td class="text-right">${taxDisplay}</td>
            <td class="text-right ${row.cfPostTax >= 0 ? 'text-success' : 'text-danger'}" style="font-weight: 600;">
                ${fmtCurrency.format(row.cfPostTax / divider)}
            </td>
            <td class="text-right">
                ${fmtCurrency.format(row.loanBalance)}
                ${subsidyDisplay}
            </td>
        `;
        tbody.appendChild(tr);
    });
}

function updateToggleUI() {
    const btnYearly = document.getElementById('btn-yearly');
    const btnMonthly = document.getElementById('btn-monthly');
    if (btnYearly && btnMonthly) {
        if (viewMode === 'yearly') {
            btnYearly.classList.add('active');
            btnYearly.style.background = 'var(--bg-panel)';
            btnYearly.style.color = '#fff';

            btnMonthly.classList.remove('active');
            btnMonthly.style.background = 'transparent';
            btnMonthly.style.color = 'var(--text-secondary)';
        } else {
            btnMonthly.classList.add('active');
            btnMonthly.style.background = 'var(--bg-panel)';
            btnMonthly.style.color = '#fff';

            btnYearly.classList.remove('active');
            btnYearly.style.background = 'transparent';
            btnYearly.style.color = 'var(--text-secondary)';
        }
    }
}

// Init
document.addEventListener('DOMContentLoaded', () => {
    bindInputs();
    bindAfaControls();
    bindSpecialAfaBadge();
    // Subscribe to changes
    store.subscribe((state, metrics) => {
        updateSpecialAfaUI(state);
        updateDashboard(state, metrics);
        renderScenarios();
        renderComparison();
        renderTimeline(metrics.returnMetrics.timeline);
        updateInputs(state);
        updateKfwUI(state);
        updateAfaRateUI(state);
    });

    // Toggle Listeners
    const btnYearly = document.getElementById('btn-yearly');
    const btnMonthly = document.getElementById('btn-monthly');

    if (btnYearly) {
        btnYearly.addEventListener('click', () => {
            viewMode = 'yearly';
            updateToggleUI();
            store.notify(); // Trigger re-render with current state
        });
    }
    if (btnMonthly) {
        btnMonthly.addEventListener('click', () => {
            viewMode = 'monthly';
            updateToggleUI();
            store.notify(); // Trigger re-render with current state
        });
    }

    // Sidebar Save Action Logic
    const btnSidebarSave = document.getElementById('btn-sidebar-save');
    const modal = document.getElementById('modal-scenario-details');
    const btnCloseModal = document.getElementById('btn-close-modal');
    const btnCancelModal = document.getElementById('btn-cancel-modal');
    const btnConfirmSave = document.getElementById('btn-confirm-save');
    const inputName = document.getElementById('input-scenario-name');
    const modalLocation = document.getElementById('modal-locationType');
    const modalCondition = document.getElementById('modal-conditionType');
    const modalMarketPricing = document.getElementById('modal-marketPricing');

    if (btnSidebarSave) {
        btnSidebarSave.addEventListener('click', () => {
            const currentId = store.currentScenarioId;
            const state = store.get();

            // Populate modal
            const scenario = currentId ? store.scenarios.find(s => s.id === currentId) : null;
            inputName.value = scenario ? scenario.name : "";
            modalLocation.value = state.locationType;
            modalCondition.value = state.conditionType;
            modalMarketPricing.value = state.marketPricing || 'fair';

            document.getElementById('modal-title').textContent = currentId ? "Update Search Details" : "Save Search Details";
            btnConfirmSave.textContent = currentId ? "Update & Save" : "Confirm & Save";

            modal.classList.add('active');
        });
    }

    const closeModal = () => modal.classList.remove('active');
    if (btnCloseModal) btnCloseModal.addEventListener('click', closeModal);
    if (btnCancelModal) btnCancelModal.addEventListener('click', closeModal);

    if (btnConfirmSave) {
        btnConfirmSave.addEventListener('click', () => {
            const name = inputName.value.trim() || "Property " + (store.scenarios.length + 1);
            const loc = parseFloat(modalLocation.value);
            const cond = parseFloat(modalCondition.value);
            const pricing = modalMarketPricing.value;

            // Update advisor fields in store before saving
            store.update('locationType', loc);
            store.update('conditionType', cond);
            store.update('marketPricing', pricing);

            if (store.currentScenarioId) {
                store.updateScenario(store.currentScenarioId);
                const scenario = store.scenarios.find(s => s.id === store.currentScenarioId);
                if (scenario) scenario.name = name;
                closeModal();
                // For update, just show the drawer
                document.getElementById('btn-toggle-portfolio').click();
            } else {
                store.saveScenario(name);
                closeModal();
                // Once saved as new, reset the form for next use
                window.location.reload();
            }
        });
    }

    // Reset Form Logic
    const btnReset = document.getElementById('btn-reset-form');
    if (btnReset) {
        btnReset.addEventListener('click', () => {
            // Silence the reset (no confirm) and reload for clean state
            window.location.reload();
        });
    }

    const btnCloseComp = document.getElementById('btn-close-comparison');
    if (btnCloseComp) {
        btnCloseComp.addEventListener('click', () => {
            store.comparisonIds = [];
            store.notify();
        });
    }

    // Tab Navigation Logic
    const tabBtns = document.querySelectorAll('.header-tab');
    const tabPanes = document.querySelectorAll('.tab-pane');

    tabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const tabId = btn.dataset.tab;

            // Update UI
            tabBtns.forEach(b => b.classList.remove('active'));
            tabPanes.forEach(p => p.classList.remove('active'));

            btn.classList.add('active');
            document.getElementById(`tab-${tabId}`).classList.add('active');
        });
    });

    // Portfolio Drawer Logic
    const drawer = document.getElementById('portfolio-drawer');
    const overlay = document.getElementById('portfolio-overlay');
    const btnToggle = document.getElementById('btn-toggle-portfolio');
    const btnClose = document.getElementById('btn-close-portfolio');

    if (btnToggle && drawer && overlay) {
        btnToggle.addEventListener('click', () => {
            drawer.classList.add('active');
            overlay.classList.add('active');
        });
    }

    if (btnClose && drawer && overlay) {
        const closeDrawer = () => {
            drawer.classList.remove('active');
            overlay.classList.remove('active');
        };
        btnClose.addEventListener('click', closeDrawer);
        overlay.addEventListener('click', closeDrawer);
    }

    updateToggleUI();
    initTooltips();

    // QNG Button
    const btnQng = document.getElementById('btn-qng');
    if (btnQng) {
        btnQng.addEventListener('click', (e) => {
            e.preventDefault();
            // Set AfA to 10%
            store.update('afaRatePercent', 10);
            updateInputs(store.get()); // Force UI update
        });
    }
});

function switchTab(tabId) {
    const btn = document.querySelector(`.header-tab[data-tab="${tabId}"]`);
    if (btn) btn.click();
}

/**
 * Premium Tooltip System
 * Handles dynamic positioning and glassmorphism styling
 */
function initTooltips() {
    const tooltip = document.createElement('div');
    tooltip.className = 'custom-tooltip';
    document.body.appendChild(tooltip);

    const triggers = document.querySelectorAll('.tooltip-trigger');

    triggers.forEach(trigger => {
        trigger.addEventListener('mouseenter', (e) => {
            const text = trigger.getAttribute('data-tooltip');
            if (!text) return;

            tooltip.innerHTML = text.replace(/\n/g, '<br>');
            tooltip.classList.add('visible');
        });

        trigger.addEventListener('mousemove', (e) => {
            const gap = 15;
            let x = e.clientX + gap;
            let y = e.clientY + gap;

            // Boundary checks
            const rect = tooltip.getBoundingClientRect();

            if (x + rect.width > window.innerWidth - 10) {
                x = e.clientX - rect.width - gap;
            }
            if (y + rect.height > window.innerHeight - 10) {
                y = e.clientY - rect.height - gap;
            }

            tooltip.style.left = `${x}px`;
            tooltip.style.top = `${y}px`;
        });

        trigger.addEventListener('mouseleave', () => {
            tooltip.classList.remove('visible');
        });
    });
}
