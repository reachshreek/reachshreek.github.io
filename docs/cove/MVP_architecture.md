# COVE Robot Arm — Software Architecture (MVP)

**Owners:** Steve (ROS 2 / IK), John (Firmware / CAN)
**Status:** Living document — update when interfaces change
**Last updated:** 2026-02-23

---

## ⚠️ Known Issues — Fix Before Writing More Code

| # | Issue | Owner | Blocking |
|---|-------|-------|---------|
| 1 | **URDF is 6-DOF** — `urdf/six_dof_arm.urdf` collapses J7 to a fixed tool link. Must be rebuilt as 7-DOF with correct link lengths from `robot_sizing.py`. | John | Steve's FK sim, MoveIt 2 |
| 2 | **TIMELINE.md** says "6-DOF" throughout — needs a correction note. | Sam | Team alignment |
| 3 | **CAN IDs not yet assigned** — John must define and document the full ID map before any firmware is written. All other SW depends on this. | John | All firmware + bridge node |

---

## 1. Hardware Layer

```
┌─────────────────────────────────────────────────────────────────┐
│                        PHYSICAL HARDWARE                         │
│                                                                   │
│  48V PSU ──────────────────────────────────────────────────┐     │
│                                                             │     │
│  CAN Bus (CANH/CANL twisted pair, 120Ω terminated)         │     │
│  ┌───────┐  ┌───────┐  ┌───────┐  ┌───────┐  ┌───────┐   │     │
│  │J1     │  │J2     │  │J3     │  │J4     │  │J5     │   │     │
│  │J10010 │  │J4340  │  │J4340  │  │J10010 │  │J4340  │   │     │
│  └───┬───┘  └───┬───┘  └───┬───┘  └───┬───┘  └───┬───┘   │     │
│      └──────────┴──────────┴──────────┴──────────┤        │     │
│                                              ┌───┴───┐    │     │
│  ┌────────┐  ┌─────────┐                    │J6     │    │     │
│  │J7      │  │Gripper  │                    │J4340  │    │     │
│  │J10010  │  │J4340    │                    └───┬───┘    │     │
│  └───┬────┘  └────┬────┘                        │        │     │
│      └────────────┴────────────────────────────┘         │     │
│                        CAN bus                            │     │
│                            │                              │     │
│                      ┌─────▼──────┐                       │     │
│                      │  Teensy    │◄─────── 48V ──────────┘     │
│                      │ (firmware) │                              │
│                      └─────┬──────┘                              │
│                            │ USB/Serial                          │
│                      ┌─────▼──────┐                              │
│                      │ Raspberry  │                              │
│                      │   Pi 5     │                              │
│                      │  (ROS 2)   │                              │
│                      └────────────┘                              │
│                                                                   │
│  E-stop ──► safety relay ──► Teensy GPIO ──► torque cutoff       │
└─────────────────────────────────────────────────────────────────┘
```

### E-stop signal path

The E-stop is a **bypass** — it cuts across the normal command path regardless of software state:

```
Normal operating path (commands flow down):

  Pi (ROS 2)  ──serial──►  Teensy  ──CAN──►  Actuators
                                                  ▲
                                               48V PSU

E-stop path (cuts across everything):

  [E-stop button]
       │
       ▼
  Safety relay opens
       │
       ├──► 48V to actuators cut immediately   (hardware, unconditional, ~ms)
       │
       └──► Teensy GPIO pin goes low
                 │
                 ▼
            Firmware detects fault
                 │
                 ├──► Zero all CAN commands
                 │
                 └──► Broadcast ESTOP fault frame to Pi
                              │
                              ▼
                         Pi marks system faulted
                         joint_commander stops accepting commands
```

Two independent effects are required:
- **Hardware kill** (relay) — fast and unconditional, doesn't wait for software
- **Software fault latch** — tells ROS the system is in fault so it can't auto-resume
```

### Actuator summary

| Joint | Actuator | CAN ID | Notes |
|-------|----------|--------|-------|
| J1 | DM-J10010-2EC | 0x01 | Base rotation — **TBC by John** |
| J2 | DM-J4340P-2EC | 0x02 | Shoulder pitch — **TBC by John** |
| J3 | DM-J4340P-2EC | 0x03 | Elbow — **TBC by John** |
| J4 | DM-J10010-2EC | 0x04 | Wrist pitch — **TBC by John** |
| J5 | DM-J4340P-2EC | 0x05 | Wrist yaw — **TBC by John** |
| J6 | DM-J4340P-2EC | 0x06 | Wrist yaw — **TBC by John** |
| J7 | DM-J10010-2EC | 0x07 | Forearm twist — **TBC by John** |
| Gripper | DM-J4340P-2EC | 0x08 | Post-MVP — **TBC by John** |

> **TODO (John):** Confirm and lock in all CAN IDs. No firmware or bridge code should hardcode
> IDs until this table is signed off. Publish the final map in `README_firmware.md`.

---

## 2. Firmware Layer (Teensy — John owns)

**Responsibilities:**

- **CAN driver:** MIT-mode protocol, one message per actuator per control cycle (~1 kHz capable, target TBD)
- **Control loop:** Receive joint targets from Pi over serial → send position/torque commands on CAN → read back encoder states → send joint states to Pi at ~100 Hz
- **Safety watchdog:** If no heartbeat received from Pi within 100 ms → zero torque all joints immediately
- **E-stop GPIO:** Hardware interrupt on safety relay pin → immediate torque cutoff to all actuators → broadcast `ESTOP` fault frame over serial to Pi
- **Position error watchdog:** If `|position_error| > 15°` for more than 500 ms → safe stop (zero torque)
- **No kinematics:** Teensy is purely a joint-level actuator interface. It has no knowledge of Cartesian space, trajectories, or robot geometry.

### Serial protocol (Pi ↔ Teensy)

Lightweight binary framing — exact byte layout TBD by John, but the logical contract is:

| Direction | Content |
|-----------|---------|
| Pi → Teensy | Target position/torque per joint (8 joints), heartbeat byte |
| Teensy → Pi | Actual position/velocity/torque per joint (8 joints), fault flags |

> **TODO (John):** Define and document the binary frame format in `README_firmware.md` before
> Steve writes the bridge node. Both sides must agree on byte layout and update rate.

---

## 3. ROS 2 Layer (Raspberry Pi 5 — Steve + John own)

```
┌──────────────────────────────────────────────────────────────────┐
│                        ROS 2 NODE GRAPH                           │
│                                                                    │
│  ┌─────────────────┐        ┌──────────────────────┐             │
│  │ teensy_bridge   │        │ robot_state_publisher │             │
│  │ (John)          │        │ (standard ROS node)   │             │
│  │                 │        │                       │             │
│  │ serial ◄──────► │        │ reads URDF + tf tree  │             │
│  │ Teensy          │        └──────────┬────────────┘             │
│  └──┬──────────────┘                   │ /tf                      │
│     │ /joint_states                    ▼                          │
│     │ /estop_event        ┌────────────────────────┐              │
│     ▼                     │  rviz2 / visualization │              │
│  ┌──────────────────┐     └────────────────────────┘              │
│  │ joint_commander  │                                              │
│  │ (Steve)          │◄── /target_joints (JointTrajectory msg)      │
│  │                  │                   ▲                          │
│  │ limit checking   │        ┌──────────┴──────────┐              │
│  │ velocity scaling │        │  trajectory_node    │  [MVP]       │
│  └──────────────────┘        │  (Steve)            │              │
│                               │  waypoint sequencer │              │
│                               └─────────────────────┘             │
│                                                                    │
│  ·  ·  ·  ·  ·  ·  ·  post-MVP  ·  ·  ·  ·  ·  ·  ·  ·  ·  ·  │
│                                                                    │
│  ┌──────────────────────────────────────────────────────────┐     │
│  │  MoveIt 2  (Cartesian planning, collision, IK solver)    │     │
│  └──────────────────────────────────────────────────────────┘     │
│                                                                    │
└──────────────────────────────────────────────────────────────────┘
```

### Node reference

| Node | Owner | Subscribes | Publishes | Responsibility |
|------|-------|-----------|----------|----------------|
| `teensy_bridge` | John | — | `/joint_states`, `/estop_event` | Serial ↔ ROS translation. Reads encoder data from Teensy, forwards joint targets from `joint_commander` over serial. |
| `joint_commander` | Steve | `/target_joints` | → Teensy via bridge | Enforces joint limits and velocity scaling. Converts `JointTrajectory` commands into per-joint targets at control rate. |
| `trajectory_node` | Steve | — | `/target_joints` | MVP demo sequencer. Sends hardcoded joint-space waypoints (home → extend → pick → retract). |
| `robot_state_publisher` | (standard) | `/joint_states` | `/tf` | Publishes forward-kinematics TF tree from URDF + current joint states. Feeds rviz2. |

### Key topics

| Topic | Message type | Publisher | Subscriber(s) |
|-------|-------------|-----------|---------------|
| `/joint_states` | `sensor_msgs/JointState` | `teensy_bridge` | `robot_state_publisher`, `joint_commander` |
| `/target_joints` | `trajectory_msgs/JointTrajectory` | `trajectory_node` | `joint_commander` |
| `/estop_event` | `std_msgs/Bool` | `teensy_bridge` | `joint_commander`, any safety monitor |
| `/tf` | `tf2_msgs/TFMessage` | `robot_state_publisher` | `rviz2`, (post-MVP: MoveIt 2) |

---

## 4. IK — Where It Lives

### MVP: joint-space only

No IK in MVP. `trajectory_node` publishes waypoints as **joint angles** directly. Steve writes
the demo sequence as a list of 7-element joint angle vectors. No Cartesian coordinates involved.

### Post-MVP: MoveIt 2

MoveIt 2 handles all Cartesian-to-joint-space conversion. Solver options:

- **KDL** — default MoveIt 2 solver, fine for initial integration
- **TRAC-IK** — better coverage for near-singular configurations, recommended for 7-DOF

The 7-DOF redundancy (one extra DOF beyond the 6 needed for full SE(3) pose) means a
**null-space policy** is required. Suggested default: elbow-up preferred configuration.

**Key prerequisite:** MoveIt 2 IK is only as good as the URDF. The 7-DOF URDF with accurate
link lengths (from `robot_sizing.py`) must be correct before MoveIt 2 integration begins.

---

## 5. MVP vs Post-MVP Scope

### In MVP

- [x] Joint-space commands to J1–J7 over CAN via Teensy
- [x] `JointCommander` node with limit checking and velocity scaling
- [x] `teensy_bridge` node (serial ↔ ROS)
- [x] `/joint_states` feedback at ~100 Hz
- [x] E-stop detection and broadcast
- [x] rviz2 visualization tracking real arm
- [x] Demo sequence: home → extend → pick pose → retract → home

### Post-MVP (do not implement during sprint)

- [ ] MoveIt 2 integration (Cartesian planning, collision avoidance)
- [ ] IK / null-space policy
- [ ] Gripper control (J8)
- [ ] Trajectory smoothing (S-curve / jerk limiting)
- [ ] Perception (camera, object detection)
- [ ] Web dashboard / remote control

---

## 6. Layer Ownership Summary

| Layer | Who | "Done" means |
|-------|-----|-------------|
| Teensy firmware | John | CAN TX/RX working, serial protocol defined, watchdog active, e-stop GPIO wired |
| `teensy_bridge` node | John | `/joint_states` published from real encoder data; joint targets forwarded to Teensy |
| `joint_commander` node | Steve | Accepts `JointTrajectory`, enforces limits, forwards targets to bridge |
| `trajectory_node` | Steve | Runs MVP demo sequence end-to-end |
| URDF (7-DOF) | John (geometry) / Steve (ROS integration) | 7 revolute joints, link lengths match `robot_sizing.py`, renders correctly in rviz2 |
| rviz2 config | Steve | Shows arm tracking real joint states during demo |

```
##Wiring Diagram
```
┌──────────────────────────────────────────────────────────────────────────────────────────────┐
│                                      MVP WIRING DIAGRAM                                     │
│                         (Power + Safety + CAN + Teensy + Pi in one view)                     │
└──────────────────────────────────────────────────────────────────────────────────────────────┘

          AC MAINS
             │
             ▼
      ┌──────────────┐
      │   48V PSU     │
      │ (DC output)   │
      └──────┬────────┘
             │ +48V
             │
        ┌────▼─────┐
        │ MAIN FUSE│   (or breaker)
        └────┬─────┘
             │ +48V (protected)
             │
             │             ┌───────────────────────────────────────────┐
             │             │             LOGIC POWER (stays on)         │
             │             │                                           │
             │             │  (tap upstream of contactor so Pi/Teensy   │
             │             │   stay alive during E-STOP)                │
             │             │                                           │
             │             │   +48V ──► [48V→5V DC/DC] ──► Pi 5 (5V)     │
             │             │                     │                      │
             │             │                     └── USB ──► Teensy 4.1 │
             │             └───────────────────────────────────────────┘
             │
             │
             │         ┌──────────────────────────────┐
             ├────────►│ SAFETY RELAY / CONTACTOR      │◄─────────── E-STOP LOOP (NC)
             │         │  (POWER CONTACTS)             │              (E-stop button)
             │         └───────┬───────────────────────┘
             │                 │ +48V (to actuators, switched OFF on E-stop)
             │                 │
             │         ┌───────▼──────────────────────────────────────────────────────────────┐
             │         │                        48V POWER DISTRIBUTION                         │
             │         │            (ideally fused per branch; star wiring preferred)          │
             │         └───────┬─────────────┬─────────────┬─────────────┬─────────────┬─────┘
             │                 │             │             │             │             │
             │              [FUSE]        [FUSE]        [FUSE]        [FUSE]        [FUSE]    ...
             │                 │             │             │             │             │
             │                 │             │             │             │             │
             ▼                 ▼             ▼             ▼             ▼             ▼
      (Actuator +48V)     J1 +48V        J2 +48V        J3 +48V        J4 +48V        J5 +48V  ...
      (Actuator GND)  all returns to a common GND bus / PSU GND (keep grounds solid)

  NOTE: Some DM manuals list “rated 24V” for certain models—confirm any motor’s allowed input
        voltage before feeding it 48V.


┌──────────────────────────────────────────────────────────────────────────────────────────────┐
│                                          CAN BUS                                             │
│                 (twisted pair trunk: CANH/CANL, daisy-chain/trunk with short stubs)           │
│               (ONLY TWO terminations total: 120Ω at each physical end of the trunk)          │
└──────────────────────────────────────────────────────────────────────────────────────────────┘

   END A                                                                                  END B
 [120Ω]───CANH/CANL───J1───J2───J3───J4───J5───J6───J7───CANH/CANL───[120Ω]
                          │
                          │ (short stub to controller is OK)
                          │
                    ┌─────▼─────────────────────────────────────────────────────────────┐
                    │                         TEENSY NODE                               │
                    │                                                                     │
                    │   Raspberry Pi 5 ───────────── USB/Serial ─────────────► Teensy 4.1 │
                    │                                                                     │
                    │   Teensy CAN_TX ──► [CAN Transceiver TXD]                           │
                    │   Teensy CAN_RX ◄── [CAN Transceiver RXD]                           │
                    │   Teensy GND   ──── [CAN Transceiver GND]                           │
                    │   Teensy 3.3/5V ─── [CAN Transceiver VCC/VIO] (depends on module)   │
                    │                                                                     │
                    │   [CAN Transceiver CANH] ───────────────► CANH trunk                │
                    │   [CAN Transceiver CANL] ───────────────► CANL trunk                │
                    └─────────────────────────────────────────────────────────────────────┘


┌──────────────────────────────────────────────────────────────────────────────────────────────┐
│                                   E-STOP “TWO EFFECTS”                                      │
│       (1) Hardware: kills actuator power  (2) Software: Teensy sees it + latches fault       │
└──────────────────────────────────────────────────────────────────────────────────────────────┘

   E-STOP button (NC) ──► Safety relay monitors loop
                             │
                             ├─ (A) POWER CONTACTS OPEN  ──► 48V to actuators OFF (torque stops)
                             │
                             └─ (B) AUX / STATUS OUTPUT  ──► Teensy GPIO input (E-stop state)
                                                            (use pull-up, detect LOW or HIGH)

   Teensy firmware response:
     - immediately command 0 torque / disable outputs
     - report ESTOP fault to Pi
     - refuse motion until reset procedure


┌──────────────────────────────────────────────────────────────────────────────────────────────┐
│                                MVP JOINT ID LABELING (example)                              │
│    (Each actuator must have a unique CAN node ID; your control/feedback frame IDs derive     │
│     from this. Label the harness + the actuator physically with the same ID.)                │
└──────────────────────────────────────────────────────────────────────────────────────────────┘

   J1: DM-J10010  ID=1      J2: DM-J4340  ID=2      J3: DM-J4340  ID=3
   J4: DM-J10010  ID=4      J5: DM-J4340  ID=5      J6: DM-J4340  ID=6
   J7: DM-J10010  ID=7

