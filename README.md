# Real-Time Usability Tracker (NeuroTrack)

A client-side, zero-dependency behavioral intelligence and usability analysis engine. It instruments DOM interactions in real-time, computes dynamic usability and friction scores, renders multi-mode spatial heatmaps, and provides in-browser session replay.

---

## 🎓 Student & Project Information

- **Student ID**: `numl-f23-29573` *(e.g., replace with your official University ID)*
- **Project Name**: Real-Time Usability Tracker
- **Repository Name**: `numl-f23-29573`
- **Course**: Human-Computer Interaction (HCI) / Web Technologies / Usability Engineering
- **Date**: October 2026

---

## 🌐 Live Demo & Deployment

This project is ready for **GitHub Pages** deployment with zero configuration:
- **Live URL**: `https://zarrar24.github.io/numl-f23-29573/`

To activate GitHub Pages:
1. Navigate to repository **Settings** > **Pages**.
2. Under **Build and deployment** > **Branch**, select `main` and `/ (root)`.
3. Click **Save**. The live URL will be active within 1–2 minutes.

---

## 📁 Repository Structure

This repository contains **exactly 3 files** as required:

```text
├── index.html        # The 1 Code file (HTML5 UI markup, responsive styles & HUD)
├── tracker.js        # The 1 JS file (Core telemetry recorder & Usability intelligence engine)
└── README.md         # The 1 Readme file (Documentation, setup, and architecture)
```

---

## ✨ Key Features

### 1. Usability Intelligence & Scoring
- **Dynamic Usability Score (0–100)**: Evaluates user friction using automated penalties for rage clicks, dead clicks, erratic cursor motion, and excessive idle periods.
- **Rage Click Detection**: Flags rapid clicking (3+ clicks within 30px in < 700ms) with auditory and visual shake feedback.
- **Dead Click Auditor**: Detects clicks on non-interactive elements that users mistakenly expect to respond.
- **Sparkline Visualizations**: Live canvas sparklines showing cursor velocity (px/s) and clicks-per-interval.
- **Scroll Attention Map**: 20-bucket vertical attention distribution based on user viewport dwell.

### 2. Multi-Mode Spatial Telemetry Overlay
- ◉ **Clicks**: High-contrast layered circular badges with sequential event numbering.
- ♨ **Heatmap**: Radial Gaussian accumulation gradient showing interaction hot-spots.
- ⁖ **Scatter**: Precision reticle crosshairs.
- 〰 **Moves**: Velocity-faded cursor trail points.
- ⚡ **Path**: Directional vector splines with speed derivatives and arrowheads.

### 3. Integrated Session Replay Player
- Replays recorded cursor motion, clicks, and page scrolls with virtual cursor tracking.
- Interactive playback controls: Play/Pause, timeline scrubber, and speed multipliers (1x, 2x, 4x).

### 4. Data Privacy & Portability
- **100% Client-Side**: No telemetry or user data leaves the browser tab.
- **Dual Format Export**: Full session payload export in structured **JSON** and tabular **CSV**.
- **Synthesized Audio**: Uses the Web Audio API for interactive auditory clicks and alert tones without external assets.

---

## 🚀 How to Run Locally

No build tools or web servers are required:

1. Clone or download the repository:
   ```bash
   git clone https://github.com/zarrar24/numl-f23-29573.git
   ```
2. Open `index.html` directly in any modern browser (Chrome, Edge, Firefox, Safari).

---

## 🛠 Tech Stack

- **Markup & Styling**: Semantic HTML5, CSS3 Custom Properties (Design Tokens), Dark/Light theme switching.
- **Scripting**: Pure Vanilla JavaScript (ES6+), Web Audio API, HTML5 2D Canvas.
- **Typography**: Google Fonts (*JetBrains Mono* & *Plus Jakarta Sans*).
- **Dependencies**: **0** (Zero external libraries or npm packages).

---

## 📄 License

This project is submitted for academic evaluation and is open-sourced under the MIT License.

