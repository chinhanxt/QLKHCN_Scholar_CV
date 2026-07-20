# Design Specification: Scholar Matcher Dashboard Redesign
Date: 2026-07-20
Status: Proposed

## 1. Overview
The dashboard will be redesigned into a light-themed, modern, neumorphic visual interface matching the look-and-feel of high-fidelity analysis portals. It utilizes custom SVG charts to ensure compatibility with React 19 without third-party chart dependencies.

## 2. Layout & Components

### 2.1 Top Stats Row (Circular Coverage Gauges)
Four cards aligned horizontally displaying progress indicators:
1.  **Clarivate Coverage**: Percentage of Clarivate indexed journals in database.
2.  **SCImago Coverage**: Percentage of SCImago indexed journals in database.
3.  **BioxBio Coverage**: Percentage of BioxBio indexed journals in database.
4.  **Overall Match Rate**: Success match percentage from the latest runs.

*Implementation*: Built using SVG circles with `strokeDasharray` and `strokeDashoffset` for smooth progress curves and CSS dropshadows.

### 2.2 Middle Area (Main Integration Trend Chart)
A wide card showing integration rates monthly.
*   **X-axis**: Jan to Dec.
*   **Y-axis**: Records matching volume.
*   *Implementation*: SVG path using quadratic/cubic bezier curves (`d="M ... C ..."`), filled with a vertical blue gradient (`linearGradient`) and interactive dot tooltips.

### 2.3 Right Sidebar Panels
1.  **Journal Quartile Distribution (Radar Chart)**: Shows the distribution of journals across Q1, Q2, Q3, and Q4 rankings.
    *   *Implementation*: SVG `<polygon>` with translucent green fill.
2.  **Overall Data Accuracy / Self-Healing Gauge**: Semicircular speedometer representation.
    *   *Implementation*: SVG arc path (`d="M 10 50 A 40 40 ..."`).

### 2.4 Bottom Grid
1.  **Domain Match Rates**: Progress bars for categories (Natural Sciences, Engineering, Y Dược, Xã hội).
2.  **DB Sizes Status Table**: Comparison stats.

## 3. Data API Requirements
Updates to the existing `/api/v1/scholar/crawlers/stats/` endpoint to return:
*   Coverage percentages (Clarivate, SCImago, BioxBio).
*   Month-by-month matching trends (array of 12 numbers).
*   Quartile count breakdown (Q1, Q2, Q3, Q4).
*   Domain match metrics.
