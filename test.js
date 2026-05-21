const fs = require('fs');
const path = require('path');
const assert = require('assert');
const vm = require('vm');

console.log("Setting up browser mocks for Bottom Line Pizza tests...");

// Mock HTML elements
const mockElements = {};
const getMockElement = (id) => {
    if (!mockElements[id]) {
        mockElements[id] = {
            textContent: '',
            style: { width: '', backgroundColor: '' },
            className: '',
            classList: {
                add(cls) { this.classes.add(cls); },
                remove(cls) { this.classes.delete(cls); },
                contains(cls) { return this.classes.has(cls); }
            },
            classes: new Set(),
            innerHTML: '',
            querySelectorAll: () => [],
            appendChild: () => {},
            addEventListener: () => {}
        };
    }
    return mockElements[id];
};

const windowMock = {
    addEventListener: () => {},
    AudioContext: class {
        resume() {}
        createOscillator() {
            return {
                connect() {},
                start() {},
                stop() {},
                type: '',
                frequency: { setValueAtTime() {} }
            };
        }
        createGain() {
            return {
                connect() {},
                gain: { setValueAtTime() {}, exponentialRampToValueAtTime() {} }
            };
        }
    },
    webkitAudioContext: null,
    DOMContentLoaded: () => {}
};

const documentMock = {
    getElementById: getMockElement,
    createElement: () => ({
        style: { setProperty() {} },
        appendChild() {},
        classList: { add() {} }
    }),
    addEventListener: () => {}
};

const localStorageMock = {
    store: {},
    getItem(key) { return this.store[key] || null; },
    setItem(key, val) { this.store[key] = val; },
    removeItem(key) { delete this.store[key]; }
};

console.log("Loading game logic script...");
const scriptPath = path.join(__dirname, 'script.js');
let scriptContent = fs.readFileSync(scriptPath, 'utf8');

// Append exports with a getter for state so we always get the reassigned reference
scriptContent += `
;
Object.defineProperty(globalThis, 'state', {
    get() { return state; },
    set(val) { state = val; }
});
globalThis.getClickPower = getClickPower;
globalThis.getProfitMultiplier = getProfitMultiplier;
globalThis.getPizzasPerSecond = getPizzasPerSecond;
globalThis.loadGame = loadGame;
`;

// Create VM context with all mock objects
const context = {
    window: windowMock,
    document: documentMock,
    localStorage: localStorageMock,
    console: console,
    Math: Math,
    Date: Date,
    setTimeout: setTimeout,
    setInterval: () => {}, // Disable intervals during testing
    audioCtx: null
};

vm.createContext(context);
vm.runInContext(scriptContent, context);

console.log("Running unit tests...");

try {
    // Test 1: Check initial game state
    assert.strictEqual(context.state.pizzas, 0, "Initial pizzas should be 0");
    assert.strictEqual(context.state.quality, 100, "Initial quality should be 100%");
    console.log("✅ Test 1 Passed: Initial game state is correct.");

    // Test 2: Click Power Calculation
    const initialClickPower = context.getClickPower();
    assert.strictEqual(initialClickPower, 1, "Initial click power should be 1");
    console.log("✅ Test 2 Passed: Initial click power matches base config.");

    // Test 3: Profit multiplier increases when quality drops
    context.state.quality = 50;
    const midQualityMult = context.getProfitMultiplier();
    // Formula: 1.0 + (100 - quality) * 0.02 = 1.0 + 50 * 0.02 = 2.0x
    assert.strictEqual(midQualityMult, 2.0, "Multiplier should be 2.0x at 50% quality");
    console.log("✅ Test 3 Passed: Profit multiplier scales inversely with quality.");

    // Test 4: PPS changes when buying Elbow Grease and moving up scoring spectrum
    context.state.quality = 100;
    assert.strictEqual(context.getPizzasPerSecond(), 0, "Initial PPS should be 0");
    
    context.state.staff.elbowGrease.count = 2; // 2 Elbow grease at 0.2 PPS each
    const elbowPps = context.getPizzasPerSecond();
    assert.strictEqual(elbowPps, 0.4, "2 Elbow Grease should produce 0.4 PPS at 100% quality");
    console.log("✅ Test 4 Passed: PPS increases correctly when hiring Elbow Grease.");

    // Test 5: Legacy save migration
    context.state.staff.elbowGrease.count = 0;
    localStorageMock.setItem('bottomLinePizzaSave', JSON.stringify({
        pizzas: 50,
        staff: {
            grandpa: { count: 3 }
        }
    }));
    
    context.loadGame();
    // Grandpa count of 3 should migrate to elbowGrease count of 3
    assert.strictEqual(context.state.staff.elbowGrease.count, 3, "Legacy grandpa should successfully migrate to elbowGrease");
    console.log("✅ Test 5 Passed: Legacy save files auto-migrate grandpa to elbowGrease.");

    console.log("\n🎉 All tests passed successfully!");
    process.exit(0);
} catch (error) {
    console.error("❌ Test failed:", error.message, error.stack);
    process.exit(1);
}
