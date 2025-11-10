// Seesaw Simulation — script.js
// ------------------------------------------------------------
// This file implements an interactive seesaw (teeter-totter)
// using only HTML/CSS/vanilla JavaScript. Users click on the
// plank to drop a random-weight object (1–10 kg) at the clicked
// position. The seesaw tilts based on torque = weight × distance.
// State and an activity log are persisted to localStorage.
// ------------------------------------------------------------

(function () {
    // ---- Configuration & storage keys --------------------------------------
    const CONFIG = {
        // Logical plank length used for torque distance calculations (in px).
        // This can be overridden by the CSS custom property --plank-length.
        PLANK_LENGTH: 400,

        // Maximum absolute tilt angle (degrees).
        MAX_ANGLE: 30,

        // Scale factor from torque difference to angle (degrees per unit torque).
        // (Kept for future tuning/experimentation; current formula divides by 10.)
        TORQUE_TO_ANGLE_SCALE: 10
    };

    // Keys for persisting simulation state and the activity log
    const STORAGE_KEY = "seesaw_state_v1";
    const LOG_KEY = "seesaw_logs_v1";

    // ---- DOM references -----------------------------------------------------
    const plankEl = document.getElementById("plank");
    const leftWeightEl = document.getElementById("leftTorque");
    const rightWeightEl = document.getElementById("rightTorque");
    const nextWeightEl = document.getElementById("nextWeight");
    const angleEl = document.getElementById("angleReadout");
    const resetBtn = document.getElementById("resetBtn");
    const logListEl = document.getElementById("logList");

    // If the plank is missing, abort early (prevents runtime errors on partial renders)
    if (!plankEl) { console.warn("[seesaw] plank element not found."); return; }

    // ---- Sync JS config with CSS custom property ---------------------------
    // Read the actual CSS width of the plank via --plank-length so our logical
    // distance calculations match what the user sees on screen.
    const cssLen = parseFloat(getComputedStyle(plankEl).getPropertyValue("--plank-length"));
    if (!Number.isNaN(cssLen) && cssLen > 0) CONFIG.PLANK_LENGTH = cssLen;

    // ---- Load initial state -------------------------------------------------
    // State shape:
    // { weights: Array<{id:string, dx:number, kg:number}>, angle:number }
    // dx is horizontal offset from center (negative = left, positive = right), in px.
    const state = loadState() || { weights: [], angle: 0 };

    // Prepare the first "next" random weight shown in the HUD
    let nextKg = randInt(1, 10);
    if (nextWeightEl) nextWeightEl.textContent = `${nextKg} kg`;

    // Clear any previous DOM nodes and re-render persisted weights
    clearPlankChildren();
    for (const w of state.weights) renderWeight(w);

    // Compute torques/angle for the loaded state and update HUD + plank transform
    let snapshot = recomputeAll(state);
    state.angle = snapshot.targetAngle;
    saveState(state);
    updateHUD(snapshot);

    // Load and render the persisted activity log
    let logs = loadLogs();
    renderLogs(logs);

    // ---- Interaction: clicking on the plank drops a weight -----------------
    plankEl.addEventListener("click", (e) => {
        // Translate click coordinate to local X within the plank’s bounding box
        const rect = plankEl.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const clampedX = clamp(x, 0, rect.width);

        // Map from rendered width to logical CONFIG.PLANK_LENGTH
        // dx < 0 => left of center, dx > 0 => right of center
        const scale = CONFIG.PLANK_LENGTH / rect.width;
        const dx = (clampedX - rect.width / 2) * scale;

        // Create a new weight using the prepared "nextKg" value
        const kg = nextKg;
        const w = { id: crypto.randomUUID(), dx, kg };
        state.weights.push(w);
        renderWeight(w, { animate: true }); // add a nice drop animation

        // Recompute physics, persist, and (slightly delayed) update HUD + play a blip
        snapshot = recomputeAll(state);
        state.angle = snapshot.targetAngle;
        saveState(state);
        setTimeout(() => {
            playHitSound();
            updateHUD(snapshot);
        }, 400);

        // Append a human-readable log entry
        addLogEntry(kg, dx);

        // Prepare the next random weight for the following click
        nextKg = randInt(1, 10);
        if (nextWeightEl) nextWeightEl.textContent = `${nextKg} kg`;

        // Dev console trace for debugging/verification
        console.log(
            `[click] kg=${kg} dx=${dx.toFixed(1)} | ` +
            `Lw=${snapshot.leftWeight.toFixed(1)}kg Rw=${snapshot.rightWeight.toFixed(1)}kg | ` +
            `Lτ=${snapshot.leftTorque.toFixed(1)} Rτ=${snapshot.rightTorque.toFixed(1)} | ` +
            `θ=${snapshot.targetAngle.toFixed(2)}°`
        );
    });

    // ---- Interaction: reset button clears state, UI, and logs --------------
    resetBtn?.addEventListener("click", () => {
        // Reset in-memory state
        state.weights = [];
        state.angle = 0;

        // Remove persisted state
        try { localStorage.removeItem(STORAGE_KEY); } catch { }

        // Reset visuals and HUD
        clearPlankChildren();
        if (leftWeightEl) leftWeightEl.textContent = "0.0 kg";
        if (rightWeightEl) rightWeightEl.textContent = "0.0 kg";
        if (angleEl) angleEl.textContent = "0.0°";

        // Re-roll the upcoming weight
        nextKg = randInt(1, 10);
        if (nextWeightEl) nextWeightEl.textContent = `${nextKg} kg`;

        // Clear and persist the activity log
        logs = [];
        saveLogs(logs);
        renderLogs(logs);

        // Visually level the plank
        plankEl.style.transform = "translateX(-50%) rotate(0deg)";
        console.log("[reset] state cleared");
    });

    // ---- Physics pipeline ---------------------------------------------------
    // Collects all physics values for the current weight set
    function recomputeAll(s) {
        const { leftTorque, rightTorque } = computeTorques(s.weights);
        const { leftWeight, rightWeight } = computeSideWeights(s.weights);
        const targetAngle = angleFromTorques(leftTorque, rightTorque);
        return { leftTorque, rightTorque, leftWeight, rightWeight, targetAngle };
    }

    // Sum torque per side: torque = Σ (weight × distanceFromCenter)
    function computeTorques(weights) {
        let leftTorque = 0, rightTorque = 0;
        for (const w of weights) {
            const dist = Math.abs(w.dx);
            const t = (w.kg || 0) * dist;
            if (w.dx < 0) leftTorque += t;
            else rightTorque += t;
        }
        return { leftTorque, rightTorque };
    }

    // Sum raw weight per side for display (not used in torque directly)
    function computeSideWeights(weights) {
        let leftWeight = 0, rightWeight = 0;
        for (const w of weights) {
            if (w.dx < 0) leftWeight += (w.kg || 0);
            else rightWeight += (w.kg || 0);
        }
        return { leftWeight, rightWeight };
    }

    // Convert torque difference to a target angle and clamp to ±MAX_ANGLE
    function angleFromTorques(leftT, rightT) {
        // Simple proportional mapping; can be refined later if needed.
        const raw = (rightT - leftT) / 10; // uses the example scale from the brief
        return Math.max(-30, Math.min(30, raw)); // clamp to [-30, 30]
    }

    // ---- Rendering ----------------------------------------------------------
    // Create and place a visual "weight" on the plank
    function renderWeight(w, opts = { animate: false }) {
        const half = CONFIG.PLANK_LENGTH / 2;
        // Size grows slightly with kg for better visual feedback
        const size = 30 + (w.kg * 4);

        const el = document.createElement("div");
        el.className = "weight " + (w.dx < 0 ? "left" : "right");
        if (opts.animate) el.classList.add("falling");

        // Position horizontally relative to the center of the plank
        el.style.left = `${half + w.dx}px`;
        el.style.width = el.style.height = `${size}px`;

        // Show the numeric kg on the chip and set a tooltip
        el.textContent = `${w.kg}kg`;
        el.title = `${w.kg} kg`;

        plankEl.appendChild(el);
    }

    // Remove all weight elements from the plank
    function clearPlankChildren() { plankEl.innerHTML = ""; }

    // Update the HUD numbers and rotate the plank toward the target angle
    function updateHUD(snap) {
        if (leftWeightEl) leftWeightEl.textContent = `${snap.leftWeight.toFixed(1)} kg`;
        if (rightWeightEl) rightWeightEl.textContent = `${snap.rightWeight.toFixed(1)} kg`;
        if (angleEl) angleEl.textContent = `${snap.targetAngle.toFixed(1)}°`;

        // CSS transition on #plank handles the smooth tilt animation
        plankEl.style.transform = `translateX(-50%) rotate(${snap.targetAngle}deg)`;
    }

    // ---- Activity log -------------------------------------------------------
    // Append a new entry to the in-memory and persisted log, then render it
    function addLogEntry(kg, dx) {
        const side = dx >= 0 ? "right" : "left";
        const dist = Math.abs(Math.round(dx));
        const text = `${kg}kg dropped on ${side} side at ${dist}px from center`;
        const entry = { t: Date.now(), text };
        logs.push(entry);
        saveLogs(logs);
        appendLogItem(entry);
        autoScrollLogs();
    }

    // Render the full list of log entries
    function renderLogs(items) {
        if (!logListEl) return;
        logListEl.innerHTML = "";
        items.forEach(appendLogItem);
        autoScrollLogs();
    }

    // Render a single log row
    function appendLogItem(entry) {
        if (!logListEl) return;
        const row = document.createElement("div");
        row.className = "log-item";

        const emoji = document.createElement("span");
        emoji.className = "log-emoji";
        emoji.textContent = "📦";

        const text = document.createElement("span");
        text.className = "log-text";
        text.textContent = entry.text;

        row.appendChild(emoji);
        row.appendChild(text);
        logListEl.appendChild(row);
    }

    // Keep the log scrolled to the most recent entry
    function autoScrollLogs() {
        if (!logListEl) return;
        logListEl.scrollTop = logListEl.scrollHeight;
    }

    // ---- Persistence helpers ------------------------------------------------
    function saveState(s) {
        try { localStorage.setItem(STORAGE_KEY, JSON.stringify(s)); }
        catch (e) { console.warn("[seesaw] saveState failed:", e); }
    }

    function loadState() {
        try {
            const raw = localStorage.getItem(STORAGE_KEY);
            if (!raw) return null;
            const data = JSON.parse(raw);
            if (!data || !Array.isArray(data.weights)) return null;
            if (typeof data.angle !== "number") data.angle = 0;
            return data;
        } catch { return null; }
    }

    function loadLogs() {
        try { const raw = localStorage.getItem(LOG_KEY); return raw ? JSON.parse(raw) : []; }
        catch { return []; }
    }

    // Persist only the most recent 200 entries to avoid unbounded growth
    function saveLogs(arr) {
        try { localStorage.setItem(LOG_KEY, JSON.stringify(arr.slice(-200))); } catch { }
    }

    // ---- Small utilities ----------------------------------------------------
    function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
    function randInt(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }

    // ---- Tiny sound effect on weight drop ----------------------------------
    // Uses WebAudio API to play a short percussive "thump" on each placement.
    function playHitSound() {
        try {
            const ctx = new (window.AudioContext || window.webkitAudioContext)();
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();

            // Low, slightly randomized pitch for variety
            osc.frequency.value = 80 + Math.random() * 40;

            // Quick decay envelope for a short clicky thump
            gain.gain.setValueAtTime(0.2, ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.25);

            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.start();
            osc.stop(ctx.currentTime + 0.25);
        } catch (e) {
            console.warn("audio not supported", e);
        }
    }

    // IIFE end — keep variables/functions scoped and avoid globals
})();
