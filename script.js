"use strict";
// Bottom Line Pizza Clicker - Core Game Logic (TypeScript Version)
// Diagnostic Error Overlay
window.onerror = function (msg, url, line, col, error) {
    const errDiv = document.getElementById('error-console');
    if (errDiv) {
        errDiv.innerHTML = `<div style="color: #ff3c00; background: #1a1a24; padding: 8px; border: 2px solid #ff3c00; margin-bottom: 5px; border-radius: 4px; box-shadow: 4px 4px 0px rgba(0,0,0,0.5);">
            <strong>TypeError:</strong> ${msg}<br>
            <span style="color: #88889c; font-size: 0.85em;">Line ${line}, Col ${col}</span><br>
            ${error && error.stack ? `<pre style="margin-top: 5px; font-size: 0.8em; overflow-x: auto; color: #ffd000;">${error.stack}</pre>` : ''}
        </div>` + errDiv.innerHTML;
    }
};
// Game State with explicit types
let state = {
    pizzas: 0,
    lifetimePizzas: 0,
    quality: 100,
    clickPowerBase: 1,
    muted: false,
    staff: {
        elbowGrease: { count: 0, cost: 30, pps: 0.2, baseCost: 30 },
        grandpa: { count: 0, cost: 95, pps: 0.7, baseCost: 95 },
        press: { count: 0, cost: 300, pps: 2.5, baseCost: 300 },
        mixer: { count: 0, cost: 2000, pps: 15.0, baseCost: 2000 },
        shredder: { count: 0, cost: 25000, pps: 90.0, baseCost: 25000 },
        inspector: { count: 0, cost: 300000, pps: 500.0, baseCost: 300000 }
    },
    upgrades: {
        expiredDough: { bought: false, cost: 50, clickMult: 1.5, ppsMult: 1.0, qualityMod: -5 },
        sawdust: { bought: false, cost: 250, clickMult: 2.0, ppsMult: 1.0, qualityMod: -15 },
        pepperoni: { bought: false, cost: 1000, clickMult: 1.0, ppsMult: 1.5, qualityMod: -20 },
        dilutedPaste: { bought: false, cost: 5000, clickMult: 1.0, ppsMult: 2.0, qualityMod: -25 },
        glowLamps: { bought: false, cost: 50000, clickMult: 2.0, ppsMult: 3.0, qualityMod: -30 }
    }
};
// Web Audio API Sound Synthesizer
let audioCtx = null;
function initAudio() {
    if (!audioCtx) {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
}
function playSound(freq, type, duration) {
    if (state.muted)
        return;
    try {
        initAudio();
        if (!audioCtx)
            return;
        if (audioCtx.state === 'suspended') {
            audioCtx.resume();
        }
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.type = type;
        osc.frequency.setValueAtTime(freq, audioCtx.currentTime);
        gain.gain.setValueAtTime(0.1, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + duration);
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.start();
        osc.stop(audioCtx.currentTime + duration);
    }
    catch (e) {
        console.warn("Audio Context error:", e);
    }
}
function playClickSound() {
    playSound(400 + Math.random() * 200, 'square', 0.08);
}
function playBuySound() {
    if (state.muted)
        return;
    try {
        initAudio();
        if (!audioCtx)
            return;
        const now = audioCtx.currentTime;
        [261.63, 329.63, 392.00, 523.25].forEach((freq, idx) => {
            setTimeout(() => {
                if (!audioCtx)
                    return;
                const osc = audioCtx.createOscillator();
                const gain = audioCtx.createGain();
                osc.type = 'triangle';
                osc.frequency.setValueAtTime(freq, audioCtx.currentTime);
                gain.gain.setValueAtTime(0.1, audioCtx.currentTime);
                gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.15);
                osc.connect(gain);
                gain.connect(audioCtx.destination);
                osc.start();
                osc.stop(audioCtx.currentTime + 0.15);
            }, idx * 60);
        });
    }
    catch (e) { }
}
function playErrorSound() {
    playSound(120, 'sawtooth', 0.25);
}
// Math Utilities
const UNIT_NAMES = [
    "", "K", "M", "B", "Tr", "Qu", "Qi", "Sx", "Sp", "Oc", "No", "De",
    "Ud", "Dd", "Td", "Qd", "Qid", "Sxd", "Spd", "Ocd", "Nod", "Vg",
    "Uvg", "Dvg", "Tvg", "Qvg", "Qivg", "Sxvg", "Spvg", "Ocvg", "Novg", "Tg",
    "Utg", "Dtg", "Ttg", "Qtg", "Qitg", "Sxtg", "Sptg", "Octg", "Notg", "Qag",
    "Uqag", "Dqag", "Tqag", "Qqag", "Qiqag", "Sxqag", "Spqag", "Ocqag", "Noqag", "Qig",
    "Uqig", "Dqig", "Tqig", "Qqig", "Qiqig", "Sxqig", "Spqig", "Ocqig", "Noqig", "Sxg",
    "Usxg", "Dsxg", "Tsxg", "Qsxg", "Qisxg", "Sxsxg", "Spsxg", "Ocsxg", "Nosxg", "Spg",
    "Uspg", "Dspg", "Tspg", "Qspg", "Qispg", "Sxspg", "Spspg", "Ocspg", "Nospg", "Ocg",
    "Uocg", "Docg", "Tocg", "Qocg", "Qiocg", "Sxocg", "Spocg", "Ococg", "Noocg", "Nog",
    "Unog", "Dnog", "Tnog", "Qnog", "Qinog", "Sxnog", "Spnog", "Ocnog", "Nonog", "Ce"
];
function formatNumber(value, precision = 0) {
    if (isNaN(value) || !isFinite(value))
        return "0";
    if (value < 0)
        return "-" + formatNumber(-value, precision);
    if (value < 1000)
        return value.toFixed(precision);
    let i = Math.floor(Math.log10(value) / 3);
    if (i >= UNIT_NAMES.length) {
        return value.toExponential(precision);
    }
    let val = value / Math.pow(1000, i);
    let strVal = val.toFixed(precision);
    if (parseFloat(strVal) >= 1000 && i < UNIT_NAMES.length - 1) {
        val /= 1000;
        i++;
        strVal = val.toFixed(precision);
    }
    return strVal + UNIT_NAMES[i];
}
function getProfitMultiplier() {
    const baseMult = 1.0 + (100 - state.quality) * 0.02;
    // Shrinkflation: Reduce multiplier as lifetime pizzas become massive
    const progress = Math.min(1, Math.log10(state.lifetimePizzas + 1) / 300);
    const shrinkflationFactor = 1.0 - (progress * 0.95); // Drastically reduce efficiency at end-game
    return baseMult * shrinkflationFactor;
}
function getClickPower() {
    let power = state.clickPowerBase;
    if (state.upgrades.expiredDough.bought)
        power *= state.upgrades.expiredDough.clickMult;
    if (state.upgrades.sawdust.bought)
        power *= state.upgrades.sawdust.clickMult;
    if (state.upgrades.glowLamps.bought)
        power *= state.upgrades.glowLamps.clickMult;
    return power * getProfitMultiplier();
}
function getBasePps() {
    let base = 0;
    Object.keys(state.staff).forEach(key => {
        const item = state.staff[key];
        base += item.count * item.pps;
    });
    return base;
}
function getPizzasPerSecond() {
    let pps = getBasePps();
    if (state.upgrades.pepperoni.bought)
        pps *= state.upgrades.pepperoni.ppsMult;
    if (state.upgrades.dilutedPaste.bought)
        pps *= state.upgrades.dilutedPaste.ppsMult;
    if (state.upgrades.glowLamps.bought)
        pps *= state.upgrades.glowLamps.ppsMult;
    return pps * getProfitMultiplier();
}
function getStaffCost(itemKey) {
    const item = state.staff[itemKey];
    if (!item)
        return 0;
    return Math.floor(item.baseCost * Math.pow(1.15, item.count));
}
// Quality Level Descriptions & styling with negative progression support
function updateQualityUI() {
    const q = state.quality;
    const qualText = document.getElementById('quality-pct');
    const qualBar = document.getElementById('quality-bar');
    const qualStatus = document.getElementById('quality-status');
    const qualEffect = document.getElementById('quality-effect');
    const moldSpots = document.getElementById('mold-spots');
    const pizzaToppings = document.getElementById('pizza-toppings');
    if (qualText)
        qualText.textContent = `${q.toFixed(1)}%`;
    if (moldSpots)
        moldSpots.innerHTML = '';
    if (qualText)
        qualText.className = '';
    let statusText = "";
    let barColor = "#4caf50";
    let barWidth = "100%";
    if (q > 75) {
        if (qualText)
            qualText.classList.add('quality-good');
        barColor = "#4caf50";
        statusText = "Freshly made standard microwave-level pizza.";
        barWidth = `${Math.min(100, q)}%`;
    }
    else if (q > 50) {
        if (qualText)
            qualText.classList.add('quality-bad');
        barColor = "#ffeb3b";
        statusText = "Cardboard crust substituted. Grease puddles forming.";
        barWidth = `${q}%`;
    }
    else if (q > 25) {
        if (qualText)
            qualText.classList.add('quality-awful');
        barColor = "#ff9800";
        statusText = "Cheapest synthetic cheese used. Smells like hot plastic.";
        barWidth = `${q}%`;
        if (state.upgrades.sawdust.bought && pizzaToppings) {
            pizzaToppings.innerHTML += '<div class="sawdust" style="top:30px; left:60px;"></div>';
            pizzaToppings.innerHTML += '<div class="sawdust" style="top:110px; left:40px;"></div>';
        }
    }
    else if (q >= 0) {
        if (qualText)
            qualText.classList.add('quality-toxic');
        barColor = "#39ff14";
        statusText = "Literally biohazardous waste. Bribed inspector turned a blind eye.";
        barWidth = `${q}%`;
        if (moldSpots) {
            moldSpots.innerHTML = `
                <div class="mold" style="top: 40px; left: 50px;"></div>
                <div class="mold" style="top: 100px; left: 120px;"></div>
                <div class="mold" style="top: 120px; left: 60px;"></div>
            `;
        }
    }
    else if (q >= -100) {
        if (qualText)
            qualText.classList.add('quality-negative-mild');
        barColor = "#9c27b0";
        statusText = "Compromise: Replaced water with industrial sludge. Crust is self-heating.";
        barWidth = `${Math.min(100, Math.abs(q))}%`;
    }
    else if (q >= -300) {
        if (qualText)
            qualText.classList.add('quality-negative-medium');
        barColor = "#e91e63";
        statusText = "Compromise: Pizza has developed a primitive central nervous system. It is whimpering.";
        barWidth = `${Math.min(100, Math.abs(q) / 3)}%`;
    }
    else if (q >= -700) {
        if (qualText)
            qualText.classList.add('quality-negative-severe');
        barColor = "#ff1744";
        statusText = "Compromise: Classified as a Class-IV biological weapon. Banned in 194 sovereign nations.";
        barWidth = `${Math.min(100, Math.abs(q) / 7)}%`;
    }
    else if (q >= -1500) {
        if (qualText)
            qualText.classList.add('quality-negative-insane');
        barColor = "#000000";
        statusText = "Compromise: Infused with weaponized plutonium. Spontaneously generates mini black holes.";
        barWidth = `${Math.min(100, Math.abs(q) / 15)}%`;
    }
    else {
        if (qualText)
            qualText.classList.add('quality-negative-cosmic');
        barColor = "#3f51b5";
        statusText = "Compromise: Reality is collapsing. The crust is made of dark matter and corporate greed.";
        barWidth = "100%";
    }
    if (qualBar) {
        qualBar.style.backgroundColor = barColor;
        qualBar.style.width = barWidth;
    }
    if (qualStatus)
        qualStatus.textContent = statusText;
    // Interpolate colors based on quality
    const ratio = Math.max(0, Math.min(100, q)) / 100;
    const crustR = Math.round(ratio * 216 + (1 - ratio) * 77);
    const crustG = Math.round(ratio * 67 + (1 - ratio) * 93);
    const crustB = Math.round(ratio * 21 + (1 - ratio) * 48);
    const cheeseR = Math.round(ratio * 255 + (1 - ratio) * 122);
    const cheeseG = Math.round(ratio * 213 + (1 - ratio) * 143);
    const cheeseB = Math.round(ratio * 79 + (1 - ratio) * 101);
    const pizzaSvg = document.getElementById('pizza-svg');
    const pizzaClicker = document.getElementById('pizza-clicker');
    if (pizzaSvg) {
        const svgCrust = document.getElementById('svg-crust');
        const svgCheese = document.getElementById('svg-cheese');
        if (svgCrust) {
            svgCrust.setAttribute('fill', `rgb(${crustR}, ${crustG}, ${crustB})`);
            svgCrust.setAttribute('stroke', `rgb(${Math.round(crustR * 0.7)}, ${Math.round(crustG * 0.7)}, ${Math.round(crustB * 0.7)})`);
        }
        if (svgCheese) {
            svgCheese.setAttribute('fill', `rgb(${cheeseR}, ${cheeseG}, ${cheeseB})`);
        }
        const bubbleR = Math.round(ratio * 255 + (1 - ratio) * 57);
        const bubbleG = Math.round(ratio * 213 + (1 - ratio) * 255);
        const bubbleB = Math.round(ratio * 79 + (1 - ratio) * 20);
        const bubbles = document.querySelectorAll('.pizza-bubble');
        bubbles.forEach(b => {
            const el = b;
            el.style.fill = `rgb(${bubbleR}, ${bubbleG}, ${bubbleB})`;
            el.style.setProperty('--bubble-opacity', ((100 - q) / 100).toFixed(2));
        });
        if (pizzaClicker) {
            pizzaClicker.style.filter = `saturate(${Math.max(0.1, ratio).toFixed(2)})`;
        }
    }
    // Update SVG Layer Opacities based on quality
    const goodToppings = document.getElementById('svg-good-toppings');
    const mildCorruption = document.getElementById('svg-mild-corruption');
    const severeCorruption = document.getElementById('svg-severe-corruption');
    if (goodToppings)
        goodToppings.style.opacity = Math.max(0, Math.min(1, q / 100)).toFixed(2);
    if (mildCorruption)
        mildCorruption.style.opacity = Math.max(0, Math.min(1, (100 - q) / 80)).toFixed(2);
    if (severeCorruption)
        severeCorruption.style.opacity = Math.max(0, Math.min(1, (0 - q) / 400)).toFixed(2);
    const mult = getProfitMultiplier();
    if (qualEffect)
        qualEffect.textContent = `Ingredient cost savings multiplier: ${mult.toFixed(2)}x Production!`;
}
// DOM elements
const pizzaButton = document.getElementById('pizza-clicker');
const pizzaCountDisplay = document.getElementById('pizza-count');
const ppsDisplay = document.getElementById('pps-display');
const clickPowerDisplay = document.getElementById('click-power');
const lifetimePizzasDisplay = document.getElementById('lifetime-pizzas');
const costCutMultDisplay = document.getElementById('cost-cut-mult');
const shopLock = document.getElementById('shop-lock');
const tabStaff = document.getElementById('tab-staff');
const tabUpgrades = document.getElementById('tab-upgrades');
const staffContainer = document.getElementById('staff-container');
const upgradesContainer = document.getElementById('upgrades-container');
const muteBtn = document.getElementById('mute-btn');
const resetBtn = document.getElementById('reset-btn');
function renderAll() {
    if (pizzaCountDisplay)
        pizzaCountDisplay.textContent = formatNumber(Math.floor(state.pizzas), 0);
    if (ppsDisplay)
        ppsDisplay.textContent = `${formatNumber(getPizzasPerSecond(), 1)} per second`;
    if (clickPowerDisplay)
        clickPowerDisplay.textContent = `${formatNumber(getClickPower(), 1)} Pizzas`;
    if (lifetimePizzasDisplay)
        lifetimePizzasDisplay.textContent = formatNumber(Math.floor(state.lifetimePizzas), 0);
    if (costCutMultDisplay)
        costCutMultDisplay.textContent = `${getProfitMultiplier().toFixed(2)}x`;
    if (shopLock) {
        if (state.lifetimePizzas >= 10) {
            shopLock.classList.add('hidden');
            shopLock.style.pointerEvents = 'none';
        }
        else {
            shopLock.classList.remove('hidden');
            shopLock.style.pointerEvents = 'auto';
        }
    }
    renderStaff();
    renderUpgrades();
    updateQualityUI();
    updateOrbitingHands();
}
function updateOrbitingHands() {
    const container = document.getElementById('orbiting-hands-container');
    if (!container)
        return;
    const count = state.staff.elbowGrease ? state.staff.elbowGrease.count : 0;
    const currentHands = container.querySelectorAll('.hand-container').length;
    if (count === currentHands)
        return;
    container.innerHTML = '';
    for (let i = 0; i < count; i++) {
        const angle = (360 / count) * i;
        const handContainer = document.createElement('div');
        handContainer.className = 'hand-container';
        handContainer.style.setProperty('--angle', `${angle}deg`);
        const hand = document.createElement('div');
        hand.className = 'orbiting-hand';
        hand.textContent = '👇';
        handContainer.appendChild(hand);
        container.appendChild(handContainer);
    }
}
function renderStaff() {
    if (!staffContainer)
        return;
    const staffData = [
        { key: 'elbowGrease', name: 'Elbow Grease', icon: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 11V6a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v0"/><path d="M14 10V4a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v2"/><path d="M10 10.5V6a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v8"/><path d="M18 8a2 2 0 1 1 4 0v6a8 8 0 0 1-8 8h-2c-2.8 0-4.5-.86-5.99-2.34l-3.6-3.6a2 2 0 0 1 2.83-2.82L7 15"/></svg>', desc: 'Cheap manual effort. Orbiting hands tap for you.', btnText: 'SLAP!' },
        { key: 'grandpa', name: 'Tired Grandpa', icon: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="5"/><path d="M20 21a8 8 0 0 0-16 0"/><line x1="8" y1="12" x2="16" y2="12"/><line x1="12" y1="16" x2="12" y2="21"/></svg>', desc: 'Cheap, forced out of retirement. Expired yeast.', btnText: 'DRAFT!' },
        { key: 'press', name: 'Dough Smasher', icon: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="14" width="18" height="8" rx="2"/><path d="M8 14v-4a4 4 0 0 1 8 0v4"/><circle cx="12" cy="18" r="2"/></svg>', desc: 'Flattens dough wafer-thin instantly.', btnText: 'SMASH!' },
        { key: 'mixer', name: 'Industrial Vat', icon: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M3 5v14a9 3 0 0 0 18 0V5"/><path d="M3 12a9 3 0 0 0 18 0"/></svg>', desc: 'Mixes water with red dye #40.', btnText: 'DUMP!' },
        { key: 'shredder', name: 'Plastic Grater', icon: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>', desc: 'Shreds cheap petroleum cheese blends.', btnText: 'SHRED!' },
        { key: 'inspector', name: 'Shady Agent', icon: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="6" cy="15" r="4"/><circle cx="18" cy="15" r="4"/><path d="M14 15a2 2 0 0 0-2-2 2 2 0 0 0-2 2"/><path d="M2.5 13 5 7c.7-1.3 1.4-2 3-2"/><path d="M21.5 13 19 7c-.7-1.3-1.5-2-3-2"/></svg>', desc: 'Bribed inspector legalizing toxicity.', btnText: 'BRIBE!' }
    ];
    staffData.forEach(item => {
        const d = state.staff[item.key];
        if (!d)
            return;
        const currentCost = getStaffCost(item.key);
        const canBuy = state.pizzas >= currentCost;
        let itemDiv = staffContainer.querySelector(`[data-key="${item.key}"]`);
        if (!itemDiv) {
            itemDiv = document.createElement('div');
            itemDiv.setAttribute('data-key', item.key);
            itemDiv.className = 'shop-item';
            itemDiv.innerHTML = `
                <div class="item-info">
                    <div class="item-title-row">
                        <span class="item-icon-small">${item.icon}</span>
                        <span class="item-name">${item.name}</span>
                        <span class="item-count">${d.count}</span>
                    </div>
                    <div class="item-desc">${item.desc}</div>
                    <div class="item-pps" style="color:var(--toxic-green);">+${formatNumber(d.pps * getProfitMultiplier(), 1)} pps each</div>
                    <div class="item-cost-row">Cost: ${formatNumber(currentCost, 0)} pizzas</div>
                </div>
                <button class="buy-btn" data-key="${item.key}">${item.btnText}</button>
            `;
            const btn = itemDiv.querySelector('.buy-btn');
            if (btn) {
                btn.addEventListener('click', () => buyStaff(item.key));
            }
            staffContainer.appendChild(itemDiv);
        }
        itemDiv.className = `shop-item ${canBuy ? 'can-buy' : ''}`;
        const countEl = itemDiv.querySelector('.item-count');
        const ppsEl = itemDiv.querySelector('.item-pps');
        const costEl = itemDiv.querySelector('.item-cost-row');
        const btn = itemDiv.querySelector('.buy-btn');
        if (countEl)
            countEl.textContent = formatNumber(d.count, 0);
        if (ppsEl)
            ppsEl.textContent = `+${formatNumber(d.pps * getProfitMultiplier(), 1)} pps each`;
        if (costEl)
            costEl.textContent = `Cost: ${formatNumber(currentCost, 0)} pizzas`;
        if (btn)
            btn.disabled = !canBuy;
    });
}
function renderUpgrades() {
    if (!upgradesContainer)
        return;
    const upgradeData = [
        { key: 'expiredDough', name: 'Sour Yeast', icon: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M7 11V7a5 5 0 0 1 10 0v4"/><rect x="3" y="11" width="18" height="10" rx="2"/><path d="M12 14v4"/></svg>', desc: 'Smells funny, but doubles click power.', btnText: 'EXPIRE!' },
        { key: 'sawdust', name: 'Wood Flour', icon: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 19V5"/><path d="m5 12 7-7 7 7"/><path d="M5 19h14"/></svg>', desc: 'Flour cut with 20% premium sawdust. Doubles click.', btnText: 'SAWDUST!' },
        { key: 'pepperoni', name: 'Mystery Slices', icon: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><circle cx="8" cy="10" r="2"/><circle cx="15" cy="8" r="1.5"/><circle cx="13" cy="15" r="2.5"/></svg>', desc: 'Slightly grey meat. Boosts pps by 1.5x.', btnText: 'SLICE!' },
        { key: 'dilutedPaste', name: 'Watered Sauce', icon: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22a7 7 0 0 0 7-7c0-2-1-3.9-3-5.5s-3.5-4-4-6.5c-.5 2.5-2 4.9-4 6.5C6 11.1 5 13 5 15a7 7 0 0 0 7 7z"/></svg>', desc: 'Sauce is mostly food color. Doubles pps.', btnText: 'DILUTE!' },
        { key: 'glowLamps', name: 'Gamma Lamps', icon: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="2"/><path d="m13.4 10.6 2.6-2.6"/><path d="m10.6 13.4-2.6 2.6"/><path d="m13.4 13.4 2.6 2.6"/><path d="m10.6 10.6-2.6-2.6"/></svg>', desc: 'Radiation heats instantly. 3x all production.', btnText: 'IRRADIATE!' }
    ];
    upgradeData.forEach(upg => {
        const d = state.upgrades[upg.key];
        if (!d)
            return;
        let upgDiv = upgradesContainer.querySelector(`[data-key="${upg.key}"]`);
        if (d.bought) {
            if (upgDiv)
                upgDiv.remove();
            return;
        }
        const canBuy = state.pizzas >= d.cost;
        if (!upgDiv) {
            upgDiv = document.createElement('div');
            upgDiv.setAttribute('data-key', upg.key);
            upgDiv.className = 'shop-item';
            upgDiv.innerHTML = `
                <div class="item-info">
                    <div class="item-title-row">
                        <span class="item-icon-small">${upg.icon}</span>
                        <span class="item-name">${upg.name}</span>
                    </div>
                    <div class="item-desc">${upg.desc}</div>
                    <div class="item-desc" style="color:var(--accent-red);">Reduces Quality: ${Math.abs(d.qualityMod)}%</div>
                    <div class="item-cost-row">Cost: ${formatNumber(d.cost, 0)} pizzas</div>
                </div>
                <button class="buy-btn" data-key="${upg.key}">${upg.btnText}</button>
            `;
            const btn = upgDiv.querySelector('.buy-btn');
            if (btn) {
                btn.addEventListener('click', () => buyUpgrade(upg.key));
            }
            upgradesContainer.appendChild(upgDiv);
        }
        upgDiv.className = `shop-item ${canBuy ? 'can-buy' : ''}`;
        const btn = upgDiv.querySelector('.buy-btn');
        if (btn)
            btn.disabled = !canBuy;
    });
    if (upgradesContainer.innerHTML === '' || upgradesContainer.children.length === 0) {
        upgradesContainer.innerHTML = '<div class="tap-hint" style="padding: 20px;">All corners cut! Perfect exploitation!</div>';
    }
}
// Buying actions
function buyStaff(itemKey) {
    const cost = getStaffCost(itemKey);
    if (state.pizzas >= cost) {
        state.pizzas -= cost;
        const item = state.staff[itemKey];
        if (item)
            item.count++;
        playBuySound();
        renderAll();
        saveGame();
    }
    else {
        playErrorSound();
    }
}
function buyUpgrade(upgKey) {
    const upg = state.upgrades[upgKey];
    if (upg && state.pizzas >= upg.cost && !upg.bought) {
        state.pizzas -= upg.cost;
        upg.bought = true;
        state.quality += upg.qualityMod;
        playBuySound();
        renderAll();
        saveGame();
    }
    else {
        playErrorSound();
    }
}
// Pizza Click Action
if (pizzaButton) {
    pizzaButton.addEventListener('click', (e) => {
        const power = getClickPower();
        state.pizzas += power;
        state.lifetimePizzas += power;
        state.quality -= 0.04;
        playClickSound();
        createParticle(e, power);
        renderAll();
    });
}
// Particle Effect
function createParticle(e, amount) {
    const container = document.getElementById('click-particles-container');
    if (!container || !pizzaButton)
        return;
    const particle = document.createElement('div');
    const randomX = (Math.random() - 0.5) * 160;
    const randomY = -120 - Math.random() * 80;
    particle.style.setProperty('--x', `${randomX}px`);
    particle.style.setProperty('--y', `${randomY}px`);
    let clientX = e.clientX;
    let clientY = e.clientY;
    if (!clientX && e.changedTouches) {
        clientX = e.changedTouches[0].clientX;
        clientY = e.changedTouches[0].clientY;
    }
    if (!clientX) {
        const rect = pizzaButton.getBoundingClientRect();
        clientX = rect.left + rect.width / 2;
        clientY = rect.top + rect.height / 2;
    }
    particle.style.left = `${clientX}px`;
    particle.style.top = `${clientY}px`;
    if (state.quality < 25 && Math.random() < 0.3) {
        const funWords = ["Sawdust!", "Mold!", "Tainted!", "Expired!", "Profits!"];
        particle.textContent = funWords[Math.floor(Math.random() * funWords.length)];
        particle.classList.add('particle-trash');
    }
    else {
        particle.textContent = `+${amount.toFixed(0)}`;
    }
    particle.className = 'particle';
    container.appendChild(particle);
    setTimeout(() => {
        particle.remove();
    }, 800);
}
// Tabs switching
if (tabStaff) {
    tabStaff.addEventListener('click', () => {
        if (tabStaff)
            tabStaff.classList.add('active');
        if (tabUpgrades)
            tabUpgrades.classList.remove('active');
        if (staffContainer)
            staffContainer.classList.remove('hidden');
        if (upgradesContainer)
            upgradesContainer.classList.add('hidden');
    });
}
if (tabUpgrades) {
    tabUpgrades.addEventListener('click', () => {
        if (tabStaff)
            tabStaff.classList.remove('active');
        if (tabUpgrades)
            tabUpgrades.classList.add('active');
        if (staffContainer)
            staffContainer.classList.add('hidden');
        if (upgradesContainer)
            upgradesContainer.classList.remove('hidden');
    });
}
// Game Loop
let lastTick = Date.now();
setInterval(() => {
    const now = Date.now();
    const dt = (now - lastTick) / 1000;
    lastTick = now;
    const pps = getPizzasPerSecond();
    if (pps > 0) {
        // Prevent overflow
        const increment = pps * dt;
        state.pizzas = Math.min(state.pizzas + increment, 1e305);
        state.lifetimePizzas = Math.min(state.lifetimePizzas + increment, 1e305);
        state.quality -= 0.003 * pps * dt;
    }
    renderAll();
}, 100);
if (muteBtn) {
    muteBtn.addEventListener('click', () => {
        state.muted = !state.muted;
        muteBtn.textContent = state.muted ? "🔇 Sound Off" : "🔊 Sound On";
        saveGame();
    });
}
if (resetBtn) {
    resetBtn.addEventListener('click', () => {
        if (confirm("Reset all progress? This will reset your bottom line to standard clean conditions!")) {
            localStorage.removeItem('bottomLinePizzaSave');
            location.reload();
        }
    });
}
function saveGame() {
    localStorage.setItem('bottomLinePizzaSave', JSON.stringify(state));
}
function loadGame() {
    const saved = localStorage.getItem('bottomLinePizzaSave');
    if (saved) {
        try {
            const parsed = JSON.parse(saved);
            state = { ...state, ...parsed };
            if (parsed.staff) {
                state.staff = { ...state.staff, ...parsed.staff };
            }
            if (parsed.upgrades)
                state.upgrades = { ...state.upgrades, ...parsed.upgrades };
            if (muteBtn)
                muteBtn.textContent = state.muted ? "🔇 Sound Off" : "🔊 Sound On";
        }
        catch (e) {
            console.warn("Could not load save game:", e);
        }
    }
}
// Ticker Logic
const ticker = document.getElementById('ticker');
const tickerMessages = [
    "NEWS: Pizza demand is steady... mostly.", "RECEPTIONIST: Your mom called, asking if you're eating properly.", "PRESS: New local pizza place opens to zero fanfare.",
    "SHAREHOLDER: Can we cut costs on the pepperoni? It's too round.", "RECEPTIONIST: An employee is asking for a chair. Deny it.",
    "PRESS: Health inspectors found something... green. Ignore it.", "RECEPTIONIST: Your friend called, they said the pizza tastes like plastic. Who cares?",
    "SHAREHOLDER: Profits are up 2%! Keep up the cardboard crusts.", "SOCIAL: #BottomLinePizza is trending for all the wrong reasons.",
    "RECEPTIONIST: Another call from the EPA. I told them you're in a meeting.",
    "PRESS: Bottom Line Pizza dominates! (With 99% market share of bad pizza).", "RECEPTIONIST: Your dad called, he's proud you're a CEO, even if it's... this.",
    "SHAREHOLDER: We are officially a Fortune 500 company! Still no napkins, though.", "SOCIAL: Our new 'Synthetic Sauce' is causing minor skin irritations. It's fine.",
    "RECEPTIONIST: The lawyers are on line 2, 3, and 4. I'll put them through?",
    "NEWS: Employees seen eating their own product? Scandalous.", "SHAREHOLDER: CEO bonus approved! Keep up the good work.",
    "RECEPTIONIST: It's your landlord, they're asking about the rent again.", "PRESS: Is it even food? Local experts say 'technically'.",
    "SOCIAL: Customer reported finding a gear in their pizza. That's free hardware!",
    "NEWS: The pizza cutter has gone missing. Use your hands.", "RECEPTIONIST: Your cat called. Meow.",
    "SHAREHOLDER: Why is the office floor sticky?", "PRESS: Bottom Line Pizza is now 'a national experience'.",
    "RECEPTIONIST: The FDA sent a strongly-worded letter.", "SOCIAL: TikTok challenge: survive one slice.",
    "NEWS: Production is at record highs. Efficiency is at 100%.", "RECEPTIONIST: Your friend is blocked. They won't stop complaining.",
    "SHAREHOLDER: More plastic, more profit!", "PRESS: Bottom Line Pizza: 'It is food'.",
    "RECEPTIONIST: The CEO of the plastic company is pleased.", "SOCIAL: #PizzaLife #MaybeToxic",
    "NEWS: The kitchen is now officially a hazardous zone.", "RECEPTIONIST: Your mom again. She says you look tired.",
    "SHAREHOLDER: We are considering synthetic pizza substitutes. Even cheaper!", "PRESS: 'Not the worst' - A review.",
    "RECEPTIONIST: The staff is asking for ventilation.", "SOCIAL: Our customers are... resilient.",
    "NEWS: Record profit! Record stomach aches!", "RECEPTIONIST: Your uncle called to complain about the pizza.",
    "SHAREHOLDER: Can we make the pizza thinner?", "PRESS: 'An innovation in food technology'.",
    "RECEPTIONIST: The fire department called. Just tell them it's a 'controlled experiment'.", "SOCIAL: Is it edible? Debatable.",
    "NEWS: Another record broken! We have no idea what it is.", "RECEPTIONIST: Your friend is calling again. Just ignore them.",
    "SHAREHOLDER: We need more growth!", "PRESS: 'A pizza-like substance'.",
    "RECEPTIONIST: The local hospital is asking why our pizzas keep arriving.", "SOCIAL: Our pizza is a cult classic. Literally.",
    "NEWS: The pizza machine is making weird noises.", "RECEPTIONIST: Your dad says he saw the news. He's... confused.",
    "SHAREHOLDER: Keep it cheap, keep it fast!", "PRESS: 'Truly a unique experience'."
];
function updateTicker() {
    if (ticker) {
        const progress = Math.min(1, state.lifetimePizzas / 50000);
        const index = Math.floor(progress * (tickerMessages.length - 1));
        ticker.textContent = tickerMessages[index];
    }
}
// Safe Initialization Function
function init() {
    loadGame();
    renderAll();
    setInterval(updateTicker, 15000);
    updateTicker();
    setInterval(saveGame, 5000);
}
if (document.readyState === 'loading') {
    window.addEventListener('DOMContentLoaded', init);
}
else {
    init();
}
