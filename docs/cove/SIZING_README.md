# COVE 6-DOF Robot Arm — Sizing Calculations

Calculates joint torques, selects actuators from a CubeMars catalog, and visualizes the reachable workspace for the COVE 6-DOF robot arm (3 kg payload target).

---

## Quick start

```bash
python3 robot_sizing.py
```

**Console output:** A sizing summary table with static and design torques, recommended actuator per joint, peak torque margin, and estimated cost.

**Generated files:**
- `workspace.png` — 3D wrist-centre point cloud + side-view reachability slice
- `torque_sweep.png` — J2 (shoulder) and J3 (elbow) torque vs arm elevation angle (0° → 90°)

---

## System architecture

```
┌─────────────────────────────────────────────────┐
│                   ArmConfig                      │
│  Link lengths · Masses · Joint ranges · Margins  │
└────────┬──────────────┬───────────────┬──────────┘
         │              │               │
         ▼              ▼               ▼
  static_torques  compute_workspace  plot_torque_sweep
  (gravity, N·m)  (80k Monte-Carlo)  (angle sweep 0→90°)
         │              │               │
         ▼              ▼               ▼
  design_torques  plot_workspace    torque_sweep.png
  (×3.0 margin)   workspace.png
         │
         ▼
  recommend_actuators
  (catalog match)
         │
         ▼
  print_summary ──▶ console report
```

---

## Configurable parameters

All parameters live in the `ArmConfig` dataclass. Override any field before calling `print_summary()`.

### Link lengths

| Parameter | Default | Units | Description |
|---|---|---|---|
| `L_upper` | 0.250 | m | J2 (shoulder) → J3 (elbow) |
| `L_forearm` | 0.220 | m | J3 (elbow) → wrist centre (J4) |
| `L_wrist_offset` | 0.100 | m | Wrist centre → gripper tip |

### Masses

| Parameter | Default | Units | Description |
|---|---|---|---|
| `m_upper_arm` | 0.900 | kg | Upper arm shell + J2 actuator |
| `m_forearm` | 0.550 | kg | Forearm shell + J3 actuator |
| `m_wrist` | 0.450 | kg | Wrist assembly (J4/J5/J6 + structure) |
| `m_gripper` | 0.200 | kg | Gripper (no sensors) |
| `m_payload` | 3.000 | kg | Carried object worst case (wine bottle) |

### Joint limits

| Parameter | Default | Units | Description |
|---|---|---|---|
| `J1_range` | (−170, 170) | deg | Base yaw |
| `J2_range` | (−90, 90) | deg | Shoulder pitch (0 = horizontal) |
| `J3_range` | (−140, 10) | deg | Elbow pitch |
| `J4_range` | (−90, 90) | deg | Wrist pitch |
| `J5_range` | (−90, 90) | deg | Wrist yaw/bend |
| `J6_range` | (−180, 180) | deg | Wrist roll |

### Margins

| Parameter | Default | Units | Description |
|---|---|---|---|
| `dynamic_factor` | 1.5 | — | Acceleration / deceleration load multiplier |
| `safety_factor` | 2.0 | — | Design margin for model error, shock, wear |

Combined multiplier applied to all static torques: `design_multiplier = dynamic_factor × safety_factor = 3.0×`

---

## Outputs

### Console report

Printed to stdout. Columns:

| Column | Meaning |
|---|---|
| Static [N·m] | Worst-case gravity torque (arm horizontal) |
| Design [N·m] | Static × 3.0 combined multiplier |
| Actuator | Smallest catalog motor whose peak torque covers the design requirement |
| Peak [N·m] | Actuator peak torque from catalog |
| Margin | How much headroom the chosen actuator has over the design requirement |
| Price | Unit price USD |

The summary also reports total actuator cost and remaining budget (of a $5,000 target).

### `workspace.png`

Two-panel figure:
- **Left** — 3D scatter of ~5,000 sampled wrist-centre positions (coloured by Z height), with a translucent max-reach sphere for reference.
- **Right** — Side-view slice (Y ≈ 0), showing reachability in the X–Z plane with the max-reach arc annotated.

### `torque_sweep.png`

Single plot of J2 shoulder and J3 elbow torques as the arm sweeps from vertical (0°) to horizontal (90°), both static and design (×3.0) curves. Confirms worst-case occurs at 90°.

---

## How torques are calculated

The script models the **worst case**: arm fully extended horizontally. Each link mass is treated as a point mass at its approximate centre of mass. The gravity torque at a joint is:

```
τ = m · g · r
```

where `r` is the horizontal distance from the joint to the mass centre.

For a joint that supports multiple distal masses the contributions are summed:

```
τ_J2 = g · (m_upper × L_upper/2  +  m_forearm × (L_upper + L_forearm/2)  +  ...)
```

The **design torque** adds margins for dynamics and model uncertainty:

```
τ_design = τ_static × dynamic_factor × safety_factor
         = τ_static × 1.5 × 2.0
         = τ_static × 3.0
```

J1 (base yaw) has near-zero gravity torque; its sizing is driven by inertial torque at an assumed angular acceleration of 90°/s².

---

## Actuator catalog

CubeMars AK-series BLDC quasi-direct-drive motors. The script picks the **smallest motor whose peak torque ≥ design requirement**.

Prices from store.cubemars.com / cubemars.com product pages, Feb 2026.

| Model | Rated [N·m] | Peak [N·m] | Ratio | Mass [kg] | Price [USD] |
|---|---|---|---|---|---|
| DM-J4340P-2EC | 9.0 | 27.0 | 40 | 0.340 | $177 |
| AK60-6 | 3.0 | 9.0 | 6 | 0.368 | $299 |
| AK70-10 | 8.3 | 24.8 | 10 | 0.521 | $399 |
| AK80-9 | 9.0 | 22.0 | 9 | 0.490 | $480 |
| AK10-9 | 18.0 | 53.0 | 9 | 0.470 | $799 |
| DM-J10010-2EC | 40.0 | 150.0 | 10 | 0.850 | $357 |

> **DM-J4340P-2EC note:** Damiao 40:1 quasi-direct-drive motor. Higher peak torque (27 N·m), ratio 40, at a lower price point. Selected over the previous motor for faster availability.

If no catalog motor is sufficient the script prints a warning flag and selects the highest-torque option.

---

## How to tune for your design

Edit the `__main__` block in `robot_sizing.py` to override any `ArmConfig` field:

```python
if __name__ == "__main__":
    cfg = ArmConfig()

    # Heavier payload (e.g. 4 kg bottle with packaging)
    cfg.m_payload = 4.0

    # Longer upper arm for more reach
    cfg.L_upper = 0.280
    cfg.L_forearm = 0.240

    # Tighter safety margin (if design is well-validated)
    cfg.safety_factor = 1.5

    # Higher dynamic factor (fast pick-and-place cycle)
    cfg.dynamic_factor = 2.0

    print_summary(cfg)
    pts = compute_workspace(cfg, n_samples=80_000)
    plot_workspace(cfg, pts)
    plot_torque_sweep(cfg)
```

Re-run after each change to see updated actuator recommendations and plots.

---

## Arm geometry

Side-view schematic. All distances are measured along the link when the arm is fully extended.

```
          ◎  Base (J1) — yaw about vertical axis
          │
          │  (column / base structure)
          │
         [J2] ← Shoulder pitch
          │
          │  L_upper = 0.250 m
          │
         [J3] ← Elbow pitch
          │
          │  L_forearm = 0.220 m
          │
         [J4/J5] ← Wrist pitch / yaw
          │
          │  L_wrist_offset = 0.100 m
          │
         [J6] ← Wrist roll
          │
          ◎  ← Gripper tip / payload CoM
```

Total tip reach: 0.570 m shoulder-to-tip
Wrist-centre reach: 0.470 m shoulder-to-wrist

Moment arms used in the worst-case torque calculation (arm horizontal):

| Mass | Distance from J2 | Distance from J3 |
|---|---|---|
| Upper arm CoM | L_upper / 2 = 0.125 m | — |
| Forearm CoM | L_upper + L_forearm / 2 = 0.360 m | L_forearm / 2 = 0.110 m |
| Wrist CoM | L_upper + L_forearm + L_wrist/2 = 0.520 m | L_forearm + L_wrist/2 = 0.270 m |
| Gripper + payload CoM | 0.570 m | 0.320 m |
