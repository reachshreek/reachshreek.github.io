# Bill of Materials — COVE 7-DOF Robot Arm

> Prices are point-in-time estimates (Feb 2026). Actuator prices from cubemars.com; hardware from
> Amazon / McMaster / SpeedyFPV / L-com. Excludes: base/pedestal, end-effector, 3D print filament,
> aluminum machining time. Linkages are machined or 3D-printed in-house; raw stock is listed but
> machined parts are not.

---

## Section 1 — Actuators

*Source: `ACTUATOR_CATALOG` + `recommend_actuators()` in `robot_sizing.py`.*

| Joint | Actuator | Peak Nm | Unit price |
|---|---|---|---|
| J1 base yaw (Z) | AK80-64 | 120 Nm | $890 |
| J2 shoulder pitch (X) | AK45-36 | 24 Nm | $186 |
| J3 shoulder roll (Y) | AK45-36 | 24 Nm | $186 |
| J4 elbow pitch (X) | AK80-64 | 120 Nm | $890 |
| J5 wrist roll (Y) | AK45-36 | 24 Nm | $186 |
| J6 wrist pitch (X) | AK45-36 | 24 Nm | $186 |
| J7 end yaw (Z) | AK80-64 | 120 Nm | $890 |
| Gripper (non-DOF) | AK45-36 | 24 Nm | $186 |
| **Actuators subtotal** | | | **$3,600** |

---

## Section 2 — Controller & Electronics

| Item | Model | Price | Notes |
|---|---|---|---|
| Host SBC | Raspberry Pi 5 (4 GB) | $85 | ROS 2, GPIO, proven CAN+arm combos |
| CAN interface HAT | PiCAN2 (MCP2515) | $28 | Most-documented Pi CAN HAT; 120 Ω terminator onboard |
| Real-time co-processor | Teensy 4.1 | $35 | Native dual CAN; runs safety loops / MIT-protocol firmware |
| USB-CAN debug adapter | CANable 2.0 | $38 | Open-source SocketCAN; use for benchtop commissioning |
| **Electronics subtotal** | | **$186** | |

---

## Section 3 — Power

| Item | Model | Price | Notes |
|---|---|---|---|
| 48 V PSU | Mean Well NDR-480-48 (480 W / 10 A) | $190 | DIN-rail, active PFC; 10 A continuous covers 4–6 joints at light–moderate duty |
| Power distribution | 2×6 terminal block + fuse holders | $15 | One fused branch per actuator |
| 48 V power cable | 14 AWG silicone, red/black, 2 m runs | $12 | From PSU to distribution and to each actuator |
| XT60H connectors | Amass XT60H 5-pair pack | $10 | Mate to AK-series power leads |
| **Power subtotal** | | **$227** | |

---

## Section 4 — Safety

| Item | Model | Price | Notes |
|---|---|---|---|
| E-stop button | IEC 60947-5-5 compliant, NC contacts, twist-release | $40 | Wired to PSU enable AND Pi GPIO; kills power + signals software shutdown |
| Safety relay module | Phoenix Contact PSR-SCP-24UC/ESA4/3X1/1X2 or equiv. | $60 | Monitors E-stop loop; dual-channel for Category 2 per ISO 13849 |
| **Safety subtotal** | | **$100** | |

---

## Section 5 — Bearings

Purpose: support link-to-link interfaces at each joint against combined radial + axial loads.
AK-series actuators have an integrated output flange; bearings seat in machined/printed housing
pockets.

| Joint(s) | Bearing | Size (ID×OD×W mm) | Qty | Unit price | Notes |
|---|---|---|---|---|---|
| J2 shoulder, J3 elbow | 6014-ZZ (standard DG, double-shielded) | 70×110×20 | 2 | $22 | Carries gravity + inertial loads; grease-packed, re-lubricate annually |
| J2/J3 (wire-routing variant) | 6814-ZZ (thin-section) | 70×90×10 | 2 | $54 | Swap in if housing wall is tight; CAN+power wires route around OD |
| J4 wrist pitch, J5 wrist roll | 6208-2RS (rubber-sealed) | 40×80×18 | 2 | $13 | Rubber seal preferred; wrist sees occasional splash/dust. **J4/J5/J6 are placeholder — pending wrist + gripper mechanical design post-MVP** |
| J6 gripper | 6208-2RS | 40×80×18 | 1 | $13 | Same family as J4/J5 for common spares |
| J1 base yaw | 6014-ZZ or 6816-ZZ (TBD on base design) | 70–80 mm bore | 1 | $22 | Base may use slew ring instead; treat as placeholder |
| **Bearings subtotal (standard DG config)** | | | **8** | | **~$180** |

> If wire-routing matters more than package size, substitute 6814-ZZ for shoulder/elbow (+$64,
> saves housing wall real-estate).

---

## Section 6 — Structural Stock

*Links machined / printed in-house; raw stock listed here.*

| Item | Spec | Supplier | Qty | Unit price | Notes |
|---|---|---|---|---|---|
| CF tube — upper arm | 25 mm OD × 2 mm wall × 500 mm, 3K roll-wrap | SpeedyFPV | 1 | $7.49 | J2→J3 link; glue or clamp into aluminum end-caps |
| CF tube — forearm | 25 mm OD × 2 mm wall × 300 mm, 3K roll-wrap | SpeedyFPV | 1 | $7.49 | J3→J4 link |
| Shaft collars | 8 mm bore double-split, 6061 Al, 8-pack | uxcell / Amazon | 1 pk | $13 | Clamp tubes onto actuator output flanges; adjust bore to match final shaft |
| Aluminum bar stock 6061-T6 | 1" × 2" × 12", for machined end-caps | Online Metals / McMaster | 2 pcs | $15 ea | End-caps and actuator mount plates; estimate only — size to CAD |
| **Structure subtotal** | | | | | **~$58** |

---

## Section 7 — Wiring & Connectors

| Item | Spec | Supplier | Qty | Unit price | Notes |
|---|---|---|---|---|---|
| CAN bus cable | 24 AWG, 1-pair, 120 Ω SF/UTP shielded, per foot | L-com #2003675-F | 30 ft | $0.85/ft ≈ $26 | Daisy-chain actuators; keep runs short (<3 m total) |
| CAN termination resistors | 120 Ω, 1/4 W, through-hole (25-pack) | Amazon / Digi-Key | 1 pk | $8 | One at each bus end; do not skip |
| PET braided sleeving | 1/4" (~6 mm) ID, 10 ft per link | Alex Tech 100 ft roll | 1 roll | $12 | Protect CAN + power bundle inside CF tubes |
| Anderson Powerpole PP30 | 30 A, red/black, 10-set unassembled | Powerwerx / Amazon | 1 pk | $13 | Branch connectors at power distribution board |
| Heat shrink assortment | 3:1 glue-lined, 3–12 mm, 100-pc | Amazon | 1 pk | $10 | Seal all crimp splices and connector entries |
| JST-GH 4-pin pigtails | For encoder/hall signals (if broken out from actuator) | Amazon | 5 pcs | $8 | Verify connector type on each AK model before ordering |
| **Wiring subtotal** | | | | | **~$77** |

---

## Section 8 — Fasteners

| Item | Spec | Supplier | Price | Notes |
|---|---|---|---|---|
| M3/M4/M5 SHCS assortment | 510-pc 304 SS, various lengths | Glarks / Amazon B08HHZHXTP | $20 | Most actuator mounting is M4–M5 |
| M3 heat-set inserts (100-pc) | Brass, OD 4.5 mm for PLA/PETG | Amazon | $10 | For 3D-printed housings |
| M4 × 50 mm hex standoffs | Al, 4-pc pack | Amazon | $8 | Mount SBC + distribution board on DIN plate |
| **Fasteners subtotal** | | | **~$38** | |

---

## Cost Summary

| Category | Subtotal |
|---|---|
| Actuators (7 joints + gripper) | $3,600 |
| Controller & Electronics | $186 |
| Power | $227 |
| Safety | $100 |
| Bearings | $180 |
| Structural stock | $58 |
| Wiring & Connectors | $77 |
| Fasteners | $38 |
| **Estimated Total** | **$4,466** |
| Budget remaining (of $5,000) | **$534** |

---

## Notes for MEs

- Bearing pocket dimensions must match chosen bearing OD. Design to **6014-ZZ: 110 mm OD**, or
  **6814-ZZ: 90 mm OD** (preferred if wire routing is constrained).
- Shaft collar bore (currently 8 mm placeholder) must match AK-series output shaft diameter —
  verify from CubeMars drawings before ordering.
- CF tube OD (25 mm) is a starting point; forearm may need 20 mm or 30 mm depending on moment
  load and wall clearance for the wire bundle.

---

## Verification Checklist

1. Run `python3 robot_sizing.py` — confirm actuator list matches BOM Section 1.
2. Cross-check actuator prices in BOM against `ACTUATOR_CATALOG` in `robot_sizing.py`.
3. Review bearing bore sizes against CAD once linkage geometry is finalized.
