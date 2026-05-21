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

// Quality Level Descriptions & styling
function updateQualityUI() {
    const qPct = Math.max(0, state.quality);
    const qualText = document.getElementById('quality-pct');
    const qualBar = document.getElementById('quality-bar');
    const qualStatus = document.getElementById('quality-status');
    const qualEffect = document.getElementById('quality-effect');
    const moldSpots = document.getElementById('mold-spots');
    const pizzaToppings = document.getElementById('pizza-toppings');

    qualText.textContent = `${qPct.toFixed(1)}%`;
    qualBar.style.width = `${qPct}%`;
    
    // Clear dynamic toppings and mold spots, rerender based on quality/upgrades
    moldSpots.innerHTML = '';
    
    // Adjust colors and texts based on current quality tiers
    qualText.className = '';
    if (qPct > 75) {
        qualText.classList.add('quality-good');
        qualBar.style.backgroundColor = '#4caf50';
        qualStatus.textContent = "Freshly made standard microwave-level pizza.";
    } else if (qPct > 50) {
        qualText.classList.add('quality-bad');
        qualBar.style.backgroundColor = '#ffeb3b';
        qualStatus.textContent = "Cardboard crust substituted. Grease puddles forming.";
    } else if (qPct > 25) {
        qualText.classList.add('quality-awful');
        qualBar.style.backgroundColor = '#ff9800';
        qualStatus.textContent = "Cheapest synthetic cheese used. Smells like hot plastic.";
        // Add sawdust particles on the pizza visual!
        if (state.upgrades.sawdust.bought) {
            pizzaToppings.innerHTML += '<div class="sawdust" style="top:30px; left:60px;"></div>';
            pizzaToppings.innerHTML += '<div class="sawdust" style="top:110px; left:40px;"></div>';
        }
    } else {
        qualText.classList.add('quality-toxic');
        qualBar.style.backgroundColor = '#39ff14';
        qualStatus.textContent = "Literally biohazardous waste. Bribed inspector turned a blind eye.";
        
        // Add mold spots on pizza!
        moldSpots.innerHTML = `
            <div class="mold" style="top: 40px; left: 50px;"></div>
            <div class="mold" style="top: 100px; left: 120px;"></div>
            <div class="mold" style="top: 120px; left: 60px;"></div>
        `;
    }

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
        // Apply quality penalty
        state.quality = Math.max(0, state.quality + upg.qualityMod);
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
    
    // Clicks slowly degrade quality (0.04% per click)
    state.quality = Math.max(0, state.quality - 0.04);
    
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
        
        // Automated factories slowly decrease quality over time (0.003% * PPS per second)
        state.quality = Math.max(0, state.quality - (0.003 * pps * dt));
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

// Initialize
window.addEventListener('DOMContentLoaded', () => {
    loadGame();
    renderAll();
    
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
});
