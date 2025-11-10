# seesaw_simulation_aysenazkonan
interactive seesaw simulation using pure javascript

# Seesaw Simulation (Pure JavaScript)

This project is a simple seesaw (teeter-totter) simulation built entirely with HTML, CSS, and pure JavaScript. When the user clicks on the plank, a random object (1–10 kg) is dropped at the exact click position and the seesaw tilts based on real torque calculations.

# Features

Clicking on the plank drops a random weight (1–10 kg).

The click position is converted into distance from the center (negative = left, positive = right).

Torque calculation: torque = weight × distance

Tilt angle: (rightTorque - leftTorque) / 10, clamped to ±30°.

Smooth rotation animation using CSS transitions.

Live HUD showing left/right total weight, next weight, and current tilt angle.

All state and activity logs are saved to localStorage (persist after refresh).

Reset button fully clears the simulation.

Small “hit” sound effect when a weight lands.

# How to Run

Simply open index.html in any modern browser.
You can also deploy the project easily using GitHub Pages.

# File Structure

index.html – Main layout and UI elements

style.css – Visual styling, animations, and HUD design

script.js – Physics logic, rendering, state management, and interactions

# Design Notes

Physics model uses a simplified torque-based calculation for clarity.

Plank length can be adjusted via the CSS variable --plank-length.

Maximum angle and torque scaling can be configured in the CONFIG object.

# AI Assistance

AI was used only for formatting the README and minor wording suggestions. 
Comment lines were also added with ai.
All core logic, implementation decisions, and code were written manually.
