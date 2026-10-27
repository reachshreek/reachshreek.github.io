# Shree Khangaonkar Portfolio

A lightweight, responsive portfolio for electrical and computer engineer Shree Khangaonkar. The site is built with semantic HTML, modern CSS, and a small amount of dependency-free JavaScript.

## Pages

- Home: introduction and current areas of focus
- About: background, robotics work, and engineering interests
- Work: selected robotics, audio, machine-learning, and creative-technology projects
- Cove: electrical and firmware documentation for the Terra Labs 7-DOF arm, at `/cove`
- Contact: email and professional profiles

The production site is hosted at [shreekhangaonkar.com](https://shreekhangaonkar.com).

## Cove documentation

`cove.html` and `cove.css` contain the project case study. The Work page gallery uses `img/coveimg/covevideo.mp4` first, followed by `cove1.jpg` through `cove4.jpg`. The SVG diagrams in that folder are editable architectural illustrations. Archived reference documents are in `docs/cove/`.

The public case study covers established build details and omits unverified implementation values. Shree's latest hardware clarification establishes a 24 V system supply, four 24 V actuators, and three 48 V actuators supplied through DC/DC conversion. The actuator ratings alternate 24/48/24/48/24/48/24 V from J1 through J7. This clarification supersedes the older 48 V PSU selection in the repository snapshot.

For conflicting technical details, the supplied GitHub repository takes priority over the generated ChatGPT conversation summary. Shree's direct build account and clarifications establish the completed work and the PSU-versus-battery decision: holding the water bottle required very little power in the intended use case. Additional architectural reasoning must be identified as explanation rather than invented historical discussion. See `docs/cove/DESIGN_DECISIONS.md` for the decision record.
