// Bottom Line Pizza Clicker - Core Game Logic

// Game State
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
    if (state.muted) return;
    try {
        initAudio();
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
    } catch (e) {
        console.warn("Audio Context error:", e);
    }
}

function playClickSound() {
    // High-pitched retro pop
    playSound(400 + Math.random() * 200, 'square', 0.08);
}

function playBuySound() {
    // Quick ascending arcade chord
    if (state.muted) return;
    try {
        initAudio();
        const now = audioCtx.currentTime;
        [261.63, 329.63, 392.00, 523.25].forEach((freq, idx) => {
            setTimeout(() => {
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
    } catch (e) {}
}

function playErrorSound() {
    // Low buzzing error tone
    playSound(120, 'sawtooth', 0.25);
}

// Math Utilities
function getProfitMultiplier() {
    // Decreasing quality makes ingredients cheaper, which multiplies production!
    return 1.0 + (100 - state.quality) * 0.02; // max +200% (3.0x multiplier) at 0% quality
}

function getClickPower() {
    let power = state.clickPowerBase;
    if (state.upgrades.expiredDough.bought) power *= state.upgrades.expiredDough.clickMult;
    if (state.upgrades.sawdust.bought) power *= state.upgrades.sawdust.clickMult;
    if (state.upgrades.glowLamps.bought) power *= state.upgrades.glowLamps.clickMult;
    return power * getProfitMultiplier();
}

function getBasePps() {
    let base = 0;
    base += state.staff.elbowGrease.count * state.staff.elbowGrease.pps;
    base += state.staff.grandpa.count * state.staff.grandpa.pps;
    base += state.staff.press.count * state.staff.press.pps;
    base += state.staff.mixer.count * state.staff.mixer.pps;
    base += state.staff.shredder.count * state.staff.shredder.pps;
    base += state.staff.inspector.count * state.staff.inspector.pps;
    return base;
}

function getPizzasPerSecond() {
    let pps = getBasePps();
    if (state.upgrades.pepperoni.bought) pps *= state.upgrades.pepperoni.ppsMult;
    if (state.upgrades.dilutedPaste.bought) pps *= state.upgrades.dilutedPaste.ppsMult;
    if (state.upgrades.glowLamps.bought) pps *= state.upgrades.glowLamps.ppsMult;
    return pps * getProfitMultiplier();
}

function getStaffCost(itemKey) {
    const item = state.staff[itemKey];
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

    qualText.textContent = `${q.toFixed(1)}%`;
    
    // Clear dynamic toppings and mold spots, rerender based on quality/upgrades
    moldSpots.innerHTML = '';
    
    // Adjust colors and texts based on current quality tiers (including negative tiers)
    qualText.className = '';
    
    let statusText = "";
    let barColor = "#4caf50";
    let barWidth = "100%";
    
    if (q > 75) {
        qualText.classList.add('quality-good');
        barColor = "#4caf50";
        statusText = "Freshly made standard microwave-level pizza.";
        barWidth = `${Math.min(100, q)}%`;
    } else if (q > 50) {
        qualText.classList.add('quality-bad');
        barColor = "#ffeb3b";
        statusText = "Cardboard crust substituted. Grease puddles forming.";
        barWidth = `${q}%`;
    } else if (q > 25) {
        qualText.classList.add('quality-awful');
        barColor = "#ff9800";
        statusText = "Cheapest synthetic cheese used. Smells like hot plastic.";
        barWidth = `${q}%`;
        // Add sawdust particles on the pizza visual!
        if (state.upgrades.sawdust.bought) {
            pizzaToppings.innerHTML += '<div class="sawdust" style="top:30px; left:60px;"></div>';
            pizzaToppings.innerHTML += '<div class="sawdust" style="top:110px; left:40px;"></div>';
        }
    } else if (q >= 0) {
        qualText.classList.add('quality-toxic');
        barColor = "#39ff14";
        statusText = "Literally biohazardous waste. Bribed inspector turned a blind eye.";
        barWidth = `${q}%`;
        
        // Add mold spots on pizza!
        moldSpots.innerHTML = `
            <div class="mold" style="top: 40px; left: 50px;"></div>
            <div class="mold" style="top: 100px; left: 120px;"></div>
            <div class="mold" style="top: 120px; left: 60px;"></div>
        `;
    } else if (q >= -100) {
        qualText.classList.add('quality-negative-mild');
        barColor = "#9c27b0"; // purple
        statusText = "Compromise: Replaced water with industrial sludge. Crust is self-heating.";
        barWidth = `${Math.min(100, Math.abs(q))}%`;
    } else if (q >= -300) {
        qualText.classList.add('quality-negative-medium');
        barColor = "#e91e63"; // deep pink
        statusText = "Compromise: Pizza has developed a primitive central nervous system. It is whimpering.";
        barWidth = `${Math.min(100, Math.abs(q) / 3)}%`;
    } else if (q >= -700) {
        qualText.classList.add('quality-negative-severe');
        barColor = "#ff1744"; // glowing red
        statusText = "Compromise: Classified as a Class-IV biological weapon. Banned in 194 sovereign nations.";
        barWidth = `${Math.min(100, Math.abs(q) / 7)}%`;
    } else if (q >= -1500) {
        qualText.classList.add('quality-negative-insane');
        barColor = "#000000"; // pitch black
        statusText = "Compromise: Infused with weaponized plutonium. Spontaneously generates mini black holes.";
        barWidth = `${Math.min(100, Math.abs(q) / 15)}%`;
    } else {
        qualText.classList.add('quality-negative-cosmic');
        barColor = "#3f51b5"; // space indigo
        statusText = "Compromise: Reality is collapsing. The crust is made of dark matter and corporate greed.";
        barWidth = "100%";
    }

    qualBar.style.backgroundColor = barColor;
    qualBar.style.width = barWidth;
    qualStatus.textContent = statusText;

    // Interpolate colors based on quality (0 to 100, supporting negative values!)
    const ratio = Math.max(0, Math.min(100, q)) / 100; // 1 = fresh, 0 = toxic
    
    // Crust color: ratio * fresh + (1 - ratio) * toxic
    // Fresh crust: #d84315 (R:216, G:67, B:21)
    // Toxic crust: #4d5d30 (R:77, G:93, B:48)
    const crustR = Math.round(ratio * 216 + (1 - ratio) * 77);
    const crustG = Math.round(ratio * 67 + (1 - ratio) * 93);
    const crustB = Math.round(ratio * 21 + (1 - ratio) * 48);
    
    // Cheese color:
    // Fresh cheese: #ffd54f (R:255, G:213, B:79)
    // Toxic cheese: #39ff14 (R:57, G:255, B:20) (neon toxic green) or green-grey
    // Let's make it a sickly desaturated green-grey #7a8f65 (R:122, G:143, B:101)
    const cheeseR = Math.round(ratio * 255 + (1 - ratio) * 122);
    const cheeseG = Math.round(ratio * 213 + (1 - ratio) * 143);
    const cheeseB = Math.round(ratio * 79 + (1 - ratio) * 101);

    // Pep color (Pepperoni):
    // Fresh pep: #c62828 (R:198, G:40, B:40)
    // Toxic pep: #2e7d32 (R:46, G:125, B:50) (sickly dark green mold spots!)
    const pepR = Math.round(ratio * 198 + (1 - ratio) * 46);
    const pepG = Math.round(ratio * 40 + (1 - ratio) * 125);
    const pepB = Math.round(ratio * 40 + (1 - ratio) * 50);

    const pizzaClicker = document.getElementById('pizza-clicker');
    const pizzaSvg = document.getElementById('pizza-svg');
    const target = pizzaSvg || pizzaClicker;
    
    if (target) {
        target.style.setProperty('--crust-color', `rgb(${crustR}, ${crustG}, ${crustB})`);
        target.style.setProperty('--crust-border', `rgb(${Math.round(crustR*0.7)}, ${Math.round(crustG*0.7)}, ${Math.round(crustB*0.7)})`);
        target.style.setProperty('--cheese-color', `rgb(${cheeseR}, ${cheeseG}, ${cheeseB})`);
        target.style.setProperty('--pep-color', `rgb(${pepR}, ${pepG}, ${pepB})`);
        target.style.setProperty('--pep-border', `rgb(${Math.round(pepR*0.7)}, ${Math.round(pepG*0.7)}, ${Math.round(pepB*0.7)})`);
        
        // Bubbles color and opacity (more intense as quality drops further below zero)
        const bubbleR = Math.round(ratio * 255 + (1 - ratio) * 57); 
        const bubbleG = Math.round(ratio * 213 + (1 - ratio) * 255);
        const bubbleB = Math.round(ratio * 79 + (1 - ratio) * 20);
        target.style.setProperty('--bubble-color', `rgb(${bubbleR}, ${bubbleG}, ${bubbleB})`);
        
        // Opacity is 0 at 100% quality, and scales up to 1.0 as it falls below 0%
        const bubbleOpacity = Math.max(0, Math.min(1.0, (100 - q) / 100));
        target.style.setProperty('--bubble-opacity', bubbleOpacity.toFixed(2));
        
        // Also desaturate the pizza container on lower quality, capping minimum saturation at 0.1
        if (pizzaClicker) {
            pizzaClicker.style.filter = `saturate(${Math.max(0.1, ratio).toFixed(2)})`;
        }
    }

    // Update SVG Layer Opacities based on quality
    const goodToppings = document.getElementById('svg-good-toppings');
    const mildCorruption = document.getElementById('svg-mild-corruption');
    const severeCorruption = document.getElementById('svg-severe-corruption');
    
    if (goodToppings) goodToppings.style.opacity = Math.max(0, Math.min(1, q / 100)).toFixed(2);
    if (mildCorruption) mildCorruption.style.opacity = Math.max(0, Math.min(1, (100 - q) / 80)).toFixed(2);
    if (severeCorruption) severeCorruption.style.opacity = Math.max(0, Math.min(1, (0 - q) / 400)).toFixed(2);

    const mult = getProfitMultiplier();
    qualEffect.textContent = `Ingredient cost savings multiplier: ${mult.toFixed(2)}x Production!`;
}

// UI Rendering & Interaction
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
    pizzaCountDisplay.textContent = Math.floor(state.pizzas).toLocaleString();
    ppsDisplay.textContent = `${getPizzasPerSecond().toFixed(1)} per second`;
    clickPowerDisplay.textContent = `${getClickPower().toFixed(1)} Pizzas`;
    lifetimePizzasDisplay.textContent = Math.floor(state.lifetimePizzas).toLocaleString();
    costCutMultDisplay.textContent = `${getProfitMultiplier().toFixed(2)}x`;

    // Unlock staffing overlay after 10 lifetime or current pizzas
    if (state.lifetimePizzas >= 10) {
        shopLock.classList.add('hidden');
    } else {
        shopLock.classList.remove('hidden');
    }

    // Render Staff Items
    renderStaff();
    
    // Render Upgrades
    renderUpgrades();

    // Quality Indicators
    updateQualityUI();

    // Render Orbiting Hands
    updateOrbitingHands();
}

function updateOrbitingHands() {
    const container = document.getElementById('orbiting-hands-container');
    if (!container) return;
    
    const count = state.staff.elbowGrease ? state.staff.elbowGrease.count : 0;
    const currentHands = container.querySelectorAll('.hand-container').length;
    
    if (count === currentHands) return;
    
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
    const staffData = [
        { key: 'elbowGrease', name: 'Elbow Grease', icon: '🖐️', desc: 'Cheap manual effort. Orbiting hands tap for you.', btnText: 'SLAP!' },
        { key: 'grandpa', name: 'Tired Grandpa', icon: '👴', desc: 'Cheap, forced out of retirement. Expired yeast.', btnText: 'DRAFT!' },
        { key: 'press', name: 'Dough Smasher', icon: '🚜', desc: 'Flattens dough wafer-thin instantly.', btnText: 'SMASH!' },
        { key: 'mixer', name: 'Industrial Vat', icon: '🛢️', desc: 'Mixes water with red dye #40.', btnText: 'DUMP!' },
        { key: 'shredder', name: 'Plastic Grater', icon: '⚙️', desc: 'Shreds cheap petroleum cheese blends.', btnText: 'SHRED!' },
        { key: 'inspector', name: 'Shady Agent', icon: '🕶️', desc: 'Bribed inspector legalizing toxicity.', btnText: 'BRIBE!' }
    ];

    staffData.forEach(item => {
        const d = state.staff[item.key];
        const currentCost = getStaffCost(item.key);
        const canBuy = state.pizzas >= currentCost;
        
        let itemDiv = staffContainer.querySelector(`[data-key="${item.key}"]`);
        
        if (!itemDiv) {
            itemDiv = document.createElement('div');
            itemDiv.setAttribute('data-key', item.key);
            itemDiv.innerHTML = `
                <div class="item-info">
                    <div class="item-title-row">
                        <span class="item-icon-small">${item.icon}</span>
                        <span class="item-name">${item.name}</span>
                        <span class="item-count">${d.count}</span>
                    </div>
                    <div class="item-desc">${item.desc}</div>
                    <div class="item-pps" style="color:var(--toxic-green);">+${(d.pps * getProfitMultiplier()).toFixed(1)} pps each</div>
                    <div class="item-cost-row">Cost: ${currentCost.toLocaleString()} pizzas</div>
                </div>
                <button class="buy-btn" data-key="${item.key}">${item.btnText}</button>
            `;
            staffContainer.appendChild(itemDiv);
        }

        // Update existing element
        itemDiv.className = `shop-item ${canBuy ? 'can-buy' : ''}`;
        itemDiv.querySelector('.item-count').textContent = d.count;
        itemDiv.querySelector('.item-pps').textContent = `+${(d.pps * getProfitMultiplier()).toFixed(1)} pps each`;
        itemDiv.querySelector('.item-cost-row').textContent = `Cost: ${currentCost.toLocaleString()} pizzas`;
    });
}

function renderUpgrades() {
    const upgradeData = [
        { key: 'expiredDough', name: 'Sour Yeast', icon: '🍞', desc: 'Smells funny, but doubles click power.', btnText: 'EXPIRE!' },
        { key: 'sawdust', name: 'Wood Flour', icon: '🪵', desc: 'Flour cut with 20% premium sawdust. Doubles click.', btnText: 'SAWDUST!' },
        { key: 'pepperoni', name: 'Mystery Slices', icon: '🍖', desc: 'Slightly grey meat. Boosts pps by 1.5x.', btnText: 'SLICE!' },
        { key: 'dilutedPaste', name: 'Watered Sauce', icon: '🥫', desc: 'Sauce is mostly food color. Doubles pps.', btnText: 'DILUTE!' },
        { key: 'glowLamps', name: 'Gamma Lamps', icon: '☢️', desc: 'Radiation heats instantly. 3x all production.', btnText: 'IRRADIATE!' }
    ];

    upgradeData.forEach(upg => {
        const d = state.upgrades[upg.key];
        let upgDiv = upgradesContainer.querySelector(`[data-key="${upg.key}"]`);
        
        if (d.bought) {
            if (upgDiv) upgDiv.remove();
            return;
        }
        
        const canBuy = state.pizzas >= d.cost;
        
        if (!upgDiv) {
            upgDiv = document.createElement('div');
            upgDiv.setAttribute('data-key', upg.key);
            upgDiv.innerHTML = `
                <div class="item-info">
                    <div class="item-title-row">
                        <span class="item-icon-small">${upg.icon}</span>
                        <span class="item-name">${upg.name}</span>
                    </div>
                    <div class="item-desc">${upg.desc}</div>
                    <div class="item-desc" style="color:var(--accent-red);">Reduces Quality: ${Math.abs(d.qualityMod)}%</div>
                    <div class="item-cost-row">Cost: ${d.cost.toLocaleString()} pizzas</div>
                </div>
                <button class="buy-btn" data-key="${upg.key}">${upg.btnText}</button>
            `;
            upgradesContainer.appendChild(upgDiv);
        }

        // Update existing element
        upgDiv.className = `shop-item ${canBuy ? 'can-buy' : ''}`;
    });

    if (upgradesContainer.innerHTML === '' || upgradesContainer.children.length === 0) {
        upgradesContainer.innerHTML = '<div class="tap-hint" style="padding: 20px;">All corners cut! Perfect exploitation!</div>';
    }
}

// Buying actions
window.buyStaff = function(itemKey) {
    const cost = getStaffCost(itemKey);
    if (state.pizzas >= cost) {
        state.pizzas -= cost;
        state.staff[itemKey].count++;
        playBuySound();
        renderAll();
        saveGame();
    } else {
        playErrorSound();
    }
};

window.buyUpgrade = function(upgKey) {
    const upg = state.upgrades[upgKey];
    if (state.pizzas >= upg.cost && !upg.bought) {
        state.pizzas -= upg.cost;
        upg.bought = true;
        // Apply quality penalty (can go negative!)
        state.quality += upg.qualityMod;
        playBuySound();
        renderAll();
        saveGame();
    } else {
        playErrorSound();
    }
};

// Pizza Click Action
pizzaButton.addEventListener('click', (e) => {
    const power = getClickPower();
    state.pizzas += power;
    state.lifetimePizzas += power;
    
    // Clicks slowly degrade quality (0.04% per click, can go negative!)
    state.quality -= 0.04;
    
    playClickSound();
    createParticle(e, power);
    renderAll();
});

// Particle Effect
function createParticle(e, amount) {
    const container = document.getElementById('click-particles-container');
    const particle = document.createElement('div');
    
    // Determine random angle/distance to float
    const randomX = (Math.random() - 0.5) * 160;
    const randomY = -120 - Math.random() * 80;
    
    particle.style.setProperty('--x', `${randomX}px`);
    particle.style.setProperty('--y', `${randomY}px`);
    
    // Position near the click or center of the button on mobile/touch
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
    
    // Custom funny words at very low quality
    if (state.quality < 25 && Math.random() < 0.3) {
        const funWords = ["Sawdust!", "Mold!", "Tainted!", "Expired!", "Profits!"];
        particle.textContent = funWords[Math.floor(Math.random() * funWords.length)];
        particle.classList.add('particle-trash');
    } else {
        particle.textContent = `+${amount.toFixed(0)}`;
    }
    
    particle.className = 'particle';
    container.appendChild(particle);
    
    setTimeout(() => {
        particle.remove();
    }, 800);
}

// Tabs switching
tabStaff.addEventListener('click', () => {
    tabStaff.classList.add('active');
    tabUpgrades.classList.remove('active');
    staffContainer.classList.remove('hidden');
    upgradesContainer.classList.add('hidden');
});

tabUpgrades.addEventListener('click', () => {
    tabStaff.classList.remove('active');
    tabUpgrades.classList.add('active');
    staffContainer.classList.add('hidden');
    upgradesContainer.classList.remove('hidden');
});

// Game Loop (Updates PPS and quality over time)
let lastTick = Date.now();
setInterval(() => {
    const now = Date.now();
    const dt = (now - lastTick) / 1000;
    lastTick = now;

    const pps = getPizzasPerSecond();
    if (pps > 0) {
        state.pizzas += pps * dt;
        state.lifetimePizzas += pps * dt;
        
        // Automated factories slowly decrease quality over time (0.003% * PPS per second, can go negative!)
        state.quality -= 0.003 * pps * dt;
    }
    
    renderAll();
}, 100);

// Mute toggle
muteBtn.addEventListener('click', () => {
    state.muted = !state.muted;
    muteBtn.textContent = state.muted ? "🔇 Sound Off" : "🔊 Sound On";
    saveGame();
});

// Reset logic
resetBtn.addEventListener('click', () => {
    if (confirm("Reset all progress? This will reset your bottom line to standard clean conditions!")) {
        localStorage.removeItem('bottomLinePizzaSave');
        location.reload();
    }
});

// Local Storage Saving
function saveGame() {
    localStorage.setItem('bottomLinePizzaSave', JSON.stringify(state));
}

function loadGame() {
    const saved = localStorage.getItem('bottomLinePizzaSave');
    if (saved) {
        try {
            const parsed = JSON.parse(saved);
            // Migrate and merge saves to prevent breaking changes if variables change
            state = { ...state, ...parsed };
            // Ensure nested objects are correctly merged too
            if (parsed.staff) {
                state.staff = { ...state.staff, ...parsed.staff };
            }
            if (parsed.upgrades) state.upgrades = { ...state.upgrades, ...parsed.upgrades };
            
            muteBtn.textContent = state.muted ? "🔇 Sound Off" : "🔊 Sound On";
        } catch (e) {
            console.warn("Could not load save game:", e);
        }
    }
}

// Ticker Logic
const ticker = document.getElementById('ticker');
const tickerMessages = [
    // Early game (0-100 pizzas)
    "NEWS: Pizza demand is steady... mostly.", "RECEPTIONIST: Your mom called, asking if you're eating properly.", "PRESS: New local pizza place opens to zero fanfare.",
    "SHAREHOLDER: Can we cut costs on the pepperoni? It's too round.", "RECEPTIONIST: An employee is asking for a chair. Deny it.",
    // Mid game (100-1000 pizzas)
    "PRESS: Health inspectors found something... green. Ignore it.", "RECEPTIONIST: Your friend called, they said the pizza tastes like plastic. Who cares?",
    "SHAREHOLDER: Profits are up 2%! Keep up the cardboard crusts.", "SOCIAL: #BottomLinePizza is trending for all the wrong reasons.",
    "RECEPTIONIST: Another call from the EPA. I told them you're in a meeting.",
    // Late game (1000+ pizzas)
    "PRESS: Bottom Line Pizza dominates! (With 99% market share of bad pizza).", "RECEPTIONIST: Your dad called, he's proud you're a CEO, even if it's... this.",
    "SHAREHOLDER: We are officially a Fortune 500 company! Still no napkins, though.", "SOCIAL: Our new 'Synthetic Sauce' is causing minor skin irritations. It's fine.",
    "RECEPTIONIST: The lawyers are on line 2, 3, and 4. I'll put them through?",
    // Extra
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
    // Pick a message based on progress
    const progress = Math.min(1, state.lifetimePizzas / 50000);
    const index = Math.floor(progress * (tickerMessages.length - 1));
    ticker.textContent = tickerMessages[index];
}

// Safe Initialization Function
function init() {
    loadGame();
    renderAll();
    
    // Ticker update loop
    setInterval(updateTicker, 15000);
    updateTicker();
    
    // Event delegation for Staff & Machinery shop items
    staffContainer.addEventListener('click', (e) => {
        const btn = e.target.closest('.buy-btn');
        if (btn) {
            const key = btn.getAttribute('data-key');
            if (key) {
                buyStaff(key);
            }
        }
    });

    // Event delegation for Upgrades (Cut Corners) items
    upgradesContainer.addEventListener('click', (e) => {
        const btn = e.target.closest('.buy-btn');
        if (btn) {
            const key = btn.getAttribute('data-key');
            if (key) {
                buyUpgrade(key);
            }
        }
    });

    // Auto-save every 5 seconds
    setInterval(saveGame, 5000);
}

// Safely execute initialization regardless of loading state (vital for fast CDNs like GitHub Pages)
if (document.readyState === 'loading') {
    window.addEventListener('DOMContentLoaded', init);
} else {
    init();
}
