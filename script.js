(function () {
  const CONFIG = {
    PLANK_LENGTH: 480,          
    MAX_ANGLE: 30,               
    TORQUE_TO_ANGLE_SCALE: 10    
  };

  const state = loadState() || {
    weights: [],
    angle: 0
  };

  const plankEl = document.getElementById("plank");
  if (!plankEl) {
    console.warn("[seesaw] plank element not found. Did you add it in index.html?");
  }

  const { leftTorque, rightTorque, targetAngle } = recomputePhysics(state);
  state.angle = targetAngle;
  saveState(state);

  window.seesaw = {
    state,
    addWeight(dx, kg) {
      const w = {
        id: crypto.randomUUID(),
        dx: Number(dx) || 0,
        kg: clamp(Math.round(kg), 1, 10)
      };
      state.weights.push(w);
      const res = recomputePhysics(state);
      state.angle = res.targetAngle;
      saveState(state);
      logSnapshot(res, "[addWeight]");
      return res;
    },
    recompute() {
      const res = recomputePhysics(state);
      state.angle = res.targetAngle;
      saveState(state);
      logSnapshot(res, "[recompute]");
      return res;
    },
    clear() {
      state.weights = [];
      state.angle = 0;
      saveState(state);
      console.log("[seesaw.clear] cleared state");
    }
  };

  function recomputePhysics(s) {
    const { leftTorque, rightTorque } = computeTorques(s.weights);
    const targetAngle = angleFromTorques(leftTorque, rightTorque);
    return { leftTorque, rightTorque, targetAngle };
  }

  function computeTorques(weights) {
    let leftTorque = 0;
    let rightTorque = 0;

    for (const w of weights) {
      const dist = Math.abs(w.dx); 
      const t = (w.kg || 0) * dist;
      if (w.dx < 0) leftTorque += t;
      else rightTorque += t;
    }
    return { leftTorque, rightTorque };
  }

  function angleFromTorques(leftT, rightT) {
    const raw = (rightT - leftT) / CONFIG.TORQUE_TO_ANGLE_SCALE;
    return clamp(raw, -CONFIG.MAX_ANGLE, CONFIG.MAX_ANGLE);
  }

  const KEY = "seesaw_state_v1";

  function saveState(s) {
    try {
      localStorage.setItem(KEY, JSON.stringify(s));
    } catch (e) {
      console.warn("[seesaw] saveState failed:", e);
    }
  }

  function loadState() {
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) return null;
      const data = JSON.parse(raw);
      if (!data || !Array.isArray(data.weights)) return null;
      if (typeof data.angle !== "number") data.angle = 0;
      return data;
    } catch {
      return null;
    }
  }

  function clamp(v, a, b) {
    return Math.max(a, Math.min(b, v));
  }

  function logSnapshot(res, tag = "") {
    console.log(
      `${tag} leftT=${res.leftTorque.toFixed(1)} rightT=${res.rightTorque.toFixed(1)} targetAngle=${res.targetAngle.toFixed(2)}°`
    );
  }

  logSnapshot({ leftTorque, rightTorque, targetAngle }, "[init]");
})();
