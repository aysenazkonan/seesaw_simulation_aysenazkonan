(function () {
    const CONFIG = {
        PLANK_LENGTH: 400,
        MAX_ANGLE: 30,
        TORQUE_TO_ANGLE_SCALE: 10
    };
    const STORAGE_KEY = "seesaw_state_v1";
    const LOG_KEY = "seesaw_logs_v1";

    const plankEl = document.getElementById("plank");
    const leftWeightEl = document.getElementById("leftTorque");
    const rightWeightEl = document.getElementById("rightTorque");
    const nextWeightEl = document.getElementById("nextWeight");
    const angleEl = document.getElementById("angleReadout");
    const resetBtn = document.getElementById("resetBtn");
    const logListEl = document.getElementById("logList");

    if (!plankEl) { console.warn("[seesaw] plank element not found."); return; }

    const cssLen = parseFloat(getComputedStyle(plankEl).getPropertyValue("--plank-length"));
    if (!Number.isNaN(cssLen) && cssLen > 0) CONFIG.PLANK_LENGTH = cssLen;

    const state = loadState() || { weights: [], angle: 0 };

    let nextKg = randInt(1, 10);
    if (nextWeightEl) nextWeightEl.textContent = `${nextKg} kg`;

    clearPlankChildren();
    for (const w of state.weights) renderWeight(w);

    let snapshot = recomputeAll(state);
    state.angle = snapshot.targetAngle;
    saveState(state);
    updateHUD(snapshot);

    let logs = loadLogs();
    renderLogs(logs);

    plankEl.addEventListener("click", (e) => {
        const rect = plankEl.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const clampedX = clamp(x, 0, rect.width);

        const scale = CONFIG.PLANK_LENGTH / rect.width;
        const dx = (clampedX - rect.width / 2) * scale;

        const kg = nextKg;
        const w = { id: crypto.randomUUID(), dx, kg };
        state.weights.push(w);
        renderWeight(w, { animate: true });


        snapshot = recomputeAll(state);
        state.angle = snapshot.targetAngle;
        saveState(state);
        setTimeout(() => {
            playHitSound();
            updateHUD(snapshot);
        }, 400);

        addLogEntry(kg, dx);

        nextKg = randInt(1, 10);
        if (nextWeightEl) nextWeightEl.textContent = `${nextKg} kg`;

        console.log(
            `[click] kg=${kg} dx=${dx.toFixed(1)} | Lw=${snapshot.leftWeight.toFixed(1)}kg Rw=${snapshot.rightWeight.toFixed(1)}kg | Lτ=${snapshot.leftTorque.toFixed(1)} Rτ=${snapshot.rightTorque.toFixed(1)} | θ=${snapshot.targetAngle.toFixed(2)}°`
        );
    });

    resetBtn?.addEventListener("click", () => {
        state.weights = [];
        state.angle = 0;
        try { localStorage.removeItem(STORAGE_KEY); } catch { }

        clearPlankChildren();
        if (leftWeightEl) leftWeightEl.textContent = "0.0 kg";
        if (rightWeightEl) rightWeightEl.textContent = "0.0 kg";
        if (angleEl) angleEl.textContent = "0.0°";

        nextKg = randInt(1, 10);
        if (nextWeightEl) nextWeightEl.textContent = `${nextKg} kg`;

        logs = [];
        saveLogs(logs);
        renderLogs(logs);

        plankEl.style.transform = "translateX(-50%) rotate(0deg)";
        console.log("[reset] state cleared");
    });

    function recomputeAll(s) {
        const { leftTorque, rightTorque } = computeTorques(s.weights);
        const { leftWeight, rightWeight } = computeSideWeights(s.weights);
        const targetAngle = angleFromTorques(leftTorque, rightTorque);
        return { leftTorque, rightTorque, leftWeight, rightWeight, targetAngle };
    }

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

    function computeSideWeights(weights) {
        let leftWeight = 0, rightWeight = 0;
        for (const w of weights) {
            if (w.dx < 0) leftWeight += (w.kg || 0);
            else rightWeight += (w.kg || 0);
        }
        return { leftWeight, rightWeight };
    }


    function angleFromTorques(leftT, rightT) {
        const raw = (rightT - leftT) / 10;                  //örnekteki formül belki ileride geliştiririm 
        return Math.max(-30, Math.min(30, raw));
    }

    function renderWeight(w, opts = { animate: false }) {
        const half = CONFIG.PLANK_LENGTH / 2;
        const size = 30 + (w.kg * 4);

        const el = document.createElement("div");
        el.className = "weight " + (w.dx < 0 ? "left" : "right");
        if (opts.animate) el.classList.add("falling");

        el.style.left = `${half + w.dx}px`;
        el.style.width = el.style.height = `${size}px`;
        el.textContent = `${w.kg}kg`;
        el.title = `${w.kg} kg`;

        plankEl.appendChild(el);
    }


    function clearPlankChildren() { plankEl.innerHTML = ""; }

    function updateHUD(snap) {
        if (leftWeightEl) leftWeightEl.textContent = `${snap.leftWeight.toFixed(1)} kg`;
        if (rightWeightEl) rightWeightEl.textContent = `${snap.rightWeight.toFixed(1)} kg`;
        if (angleEl) angleEl.textContent = `${snap.targetAngle.toFixed(1)}°`;

        plankEl.style.transform = `translateX(-50%) rotate(${snap.targetAngle}deg)`;
    }


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

    function renderLogs(items) {
        if (!logListEl) return;
        logListEl.innerHTML = "";
        items.forEach(appendLogItem);
        autoScrollLogs();
    }

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

    function autoScrollLogs() {
        if (!logListEl) return;
        logListEl.scrollTop = logListEl.scrollHeight;
    }


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
    function saveLogs(arr) {
        try { localStorage.setItem(LOG_KEY, JSON.stringify(arr.slice(-200))); } catch { }
    }

    function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
    function randInt(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }

    //animasyon ve ses eklenecek en son buraya
    function playHitSound() {
        try {
            const ctx = new (window.AudioContext || window.webkitAudioContext)();
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();


            osc.frequency.value = 80 + Math.random() * 40;
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

})();
