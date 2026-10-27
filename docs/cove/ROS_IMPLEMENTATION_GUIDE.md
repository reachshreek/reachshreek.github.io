# ROS Implementation Guide: COVE Robotic Arm

## 1. Project Snapshot (Current State in This Repository)

### What exists today
- Mechanical sizing and torque analysis scripts:
  - `robot_sizing.py`
  - `mount_loading_calcs.py`
- A complete URDF model (duplicated in two locations):
  - `six_dof_arm.urdf`
  - `urdf/six_dof_arm.urdf`
- CAD actuator design assets:
  - `CAD_components/Actuators/` (motor STEP/STP files — update with DM datasheets)
  - corresponding tech drawing images
- Procurement and integration planning:
  - `BOM.md`, `BOM.csv`
  - `TIMELINE.md`

### What the URDF currently represents
- A **6-DOF chain** (`joint_1` to `joint_6`) plus a fixed tool link.
- Link geometry is mostly primitive shapes (box/cylinder/sphere), not final mesh CAD.
- Joint limits, inertias, and damping values are present.
- Transmission tags already exist for each revolute joint using `SimpleTransmission` with:
  - `hardware_interface/PositionJointInterface`
  - mechanical reductions of `10` (DM-J10010-2EC joints) and `40` (DM-J4340P-2EC joints).

### Important mismatch to keep in mind
- Sizing/BOM/timeline files are largely written as a **7-DOF concept** (includes J7 end yaw).
- The URDF is currently **6-DOF** (J7 replaced by fixed tool).
- This must be resolved before final MoveIt and hardware software integration.

### What is missing (software side)
- No ROS package structure yet (`package.xml`, launch files, controller config, hardware interface node, MoveIt config are not present).
- No firmware source is currently in this repo.
- No Gazebo simulation setup is present yet.

---

## 2. Essential ROS Concepts for This Project

### Nodes
- A node is one running ROS process with a specific job.
- For this arm, typical nodes will be:
  - `robot_state_publisher` (publishes transforms from URDF + joint states)
  - hardware driver node (talks to Teensy/CAN and publishes real joint states)
  - `controller_manager` + controllers (runs control loops)
  - MoveIt planning node(s)
  - RViz visualization

### Topics
- Topics are named data channels between nodes.
- Key topics for this arm:
  - `/joint_states` (actual joint position/velocity/effort feedback)
  - `/tf` and `/tf_static` (frame transforms)
  - `/joint_trajectory_controller/joint_trajectory` (trajectory commands)

### Messages
- Messages define data format sent on topics.
- Core message types you will use:
  - `sensor_msgs/JointState` for feedback
  - `trajectory_msgs/JointTrajectory` for multi-joint motion commands
  - `geometry_msgs/TransformStamped` under TF publication

### TF (Transforms)
- TF is the live tree of coordinate frames (for example `base_link -> link_1 -> ... -> tool_link`).
- RViz, MoveIt, and planners depend on correct TF.
- If TF is wrong, the robot may look fine visually but plan and execute wrong motions.

### URDF and `robot_state_publisher`
- URDF describes robot kinematics, visual/collision geometry, inertial properties, and joint limits.
- `robot_state_publisher` takes:
  - the URDF model
  - current joint values (from `/joint_states`)
  - and publishes TF for every link.
- In this project, your URDF already provides the starting kinematic chain and limits.

### `ros_control` / `ros2_control` and `controller_manager`
- Conceptually:
  - hardware interface exposes joints to ROS as command/state interfaces
  - controllers generate commands at a fixed update rate
  - `controller_manager` loads, starts, stops, and switches controllers
- In ROS 2, this stack is called `ros2_control` (same architecture idea as ROS 1 `ros_control`).
- For this arm, this layer is where ROS commands become actuator commands via your driver/firmware.

### `joint_trajectory_controller`
- This is the standard controller for commanded joint-space paths.
- It takes waypoint trajectories and handles interpolation/timing.
- It is the normal bridge between MoveIt and your low-level joint interface.
- For a new team, this is usually the fastest stable path to useful motion.

### Gazebo simulation
- Gazebo provides physics simulation for joint dynamics and collision.
- You can run the same control stack in simulation first:
  - URDF + simulated hardware plugin
  - same controller configuration
  - same trajectory commands
- This lets you test integration before risking physical hardware.

### MoveIt motion planning
- MoveIt plans collision-aware paths from current pose to goal pose.
- It outputs time-parameterized joint trajectories.
- It depends on:
  - correct URDF/SRDF
  - valid joint limits
  - reliable current state feedback
  - working trajectory controller

---

## 3. Target System Architecture

### Layered architecture (recommended)
- Firmware layer:
  - Teensy safety loop, heartbeat watchdog, motor protocol handling (MIT/CAN style commanding).
- Hardware interface / driver node:
  - maps ROS joint commands and states to firmware/API.
- Control layer (`ros2_control`):
  - `controller_manager`
  - `joint_state_broadcaster`
  - `joint_trajectory_controller`
- Planning layer:
  - MoveIt for planning + execution.
- Simulation layer:
  - Gazebo with the same URDF/control interfaces for pre-hardware validation.

### ASCII architecture diagram
```text
                        +----------------------+
                        |      RViz / UI       |
                        +----------+-----------+
                                   |
                                   v
                        +----------------------+
                        |        MoveIt        |
                        | (planning/execution) |
                        +----------+-----------+
                                   |
                  JointTrajectory  v
                        +----------------------+
                        | joint_trajectory_    |
                        | controller           |
                        +----------+-----------+
                                   |
                                   v
                        +----------------------+
                        |  ros2_control +      |
                        |  controller_manager  |
                        +----------+-----------+
                                   |
                    joint cmd/state v
                        +----------------------+
                        |  Hardware Interface  |
                        |   (ROS driver node)  |
                        +----------+-----------+
                                   |
                            serial/CAN link
                                   |
                                   v
                        +----------------------+
                        |   Teensy Firmware    |
                        | (watchdog + safety)  |
                        +----------+-----------+
                                   |
                                  CAN
                                   |
                                   v
                        +----------------------+
                        | Damiao Actuators     |
                        | J10010 / J4340       |
                        +----------------------+

Parallel sim path:
URDF + Gazebo plugin + same ros2_control/controllers + same MoveIt interface
```

---

## 4. Recommended Control Strategy for This Repository

### Recommendation: Position control at ROS level (with strict limits), torque-limited at firmware level

Given your actuator selection (DM-J10010-2EC and DM-J4340P-2EC quasi-direct-drive motors), current URDF transmissions, and team maturity target, start with:
- ROS command mode: **joint position trajectories** via `joint_trajectory_controller`
- Firmware inner loop: actuator-level PD/impedance command with:
  - torque/current limit clamps
  - watchdog timeout
  - hard safety interlocks

### Why this is the right default now
- Your URDF already declares position interfaces in transmission tags.
- Position trajectories integrate directly with MoveIt.
- It is easier to tune and debug for first hardware bring-up.
- It minimizes risk while your mechanical design is still evolving (especially wrist/end-effector).

### Tradeoffs (simple comparison)
- Position control:
  - Pros: easiest integration with MoveIt, predictable motion, beginner-friendly.
  - Cons: can feel stiff if gains are high; less inherently compliant.
- Velocity control:
  - Pros: smooth streaming behavior for teleop or conveyor tracking.
  - Cons: harder to hold static pose against gravity/load without good low-level logic.
- Torque control:
  - Pros: best for compliance and force interaction.
  - Cons: highest tuning complexity and safety risk; needs mature model and robust sensing.

### Practical upgrade path
- Phase in torque/impedance features later per-joint after:
  - encoder zeroing is reliable
  - position loop is stable
  - safety chain is proven under fault tests.

---

## 5. Staged Implementation Roadmap

### Phase 1 - Get URDF working in RViz

### Goals
- Validate kinematic chain, joint axes, limits, and TF tree.
- Make the robot model visually and kinematically trustworthy before controls.

### What to implement
- Create a ROS 2 description package for the current URDF.
- Launch:
  - `robot_state_publisher`
  - joint-state source for manual slider testing
  - RViz with fixed frame set to base frame
- Verify frames and link naming conventions are consistent and future-proof.
- Decide and document whether the project baseline is 6-DOF or 7-DOF.

### How to test / validate
- Sweep each joint through limits and confirm motion matches intended physical axis.
- Confirm TF tree is contiguous and stable (`base_link` to `tool_link`).
- Confirm no flipped axes or mirrored joints in RViz.
- Exit criterion: every joint moves correctly in visualization and TF is clean.

### Phase 2 - Simulate with `ros_control` (`ros2_control` in ROS 2) + Gazebo

### Goals
- Stand up full control loop in simulation before touching hardware.
- Verify trajectory tracking, limits, and controller behavior.

### What to implement
- Add `ros2_control` configuration for all joints:
  - command interface: position
  - state interfaces: position/velocity/effort
- Add controllers:
  - `joint_state_broadcaster`
  - `joint_trajectory_controller`
- Add Gazebo simulation package and robot spawn launch.
- Ensure simulation uses the same joint names and limits as URDF.

### How to test / validate
- Send simple single-joint and multi-joint trajectories.
- Check commanded vs observed trajectories in plots.
- Confirm no instability/oscillation at conservative gains.
- Exit criterion: simulated arm can execute repeatable joint trajectories with bounded tracking error.

### Phase 3 - Bring up one real joint

### Goals
- Prove end-to-end real hardware path with minimal risk.
- Validate firmware-driver-controller loop for one actuator.

### What to implement
- Firmware for one actuator with:
  - heartbeat timeout (already required by your timeline)
  - torque limit clamp
  - explicit fault state
- Driver node that maps one ROS joint interface to one CAN actuator.
- Encoder zero offset handling and persistent calibration storage.
- Single-joint controller config (same controller stack, scoped to one joint).

### How to test / validate
- With arm unloaded/offline fixture:
  - move to small angle step targets
  - verify direction/sign and measured position correctness
  - trigger heartbeat loss and confirm torque drops as expected
  - trigger E-stop and confirm power removal plus software fault detection
- Exit criterion: one joint is repeatably controllable and fails safe.

### Phase 4 - Full arm hardware integration

### Goals
- Scale from one joint to all joints with safe startup/shutdown behavior.
- Establish reliable real `/joint_states` and trajectory execution.

### What to implement
- Expand firmware + driver to all arm joints.
- Finalize CAN ID map and joint mapping document.
- Add per-joint soft limits and sanity checks (position/velocity bounds).
- Add startup checks:
  - communication alive
  - encoder validity
  - calibration loaded
  - E-stop status healthy

### How to test / validate
- Joint-by-joint motion test at low speed (10-20% max).
- Multi-joint scripted motion through safe waypoints.
- Verify no joint saturates unexpectedly under gravity.
- Repeat E-stop and watchdog fault tests while moving.
- Exit criterion: full arm tracks commanded trajectories at low speed with repeatable safety behavior.

### Phase 5 - Motion planning integration (MoveIt)

### Goals
- Achieve plan-and-execute motion from high-level goals.
- Ensure collision-aware planning is consistent with real hardware.

### What to implement
- Generate MoveIt config for the finalized DOF configuration.
- Define planning group(s), end-effector link, and collision matrix.
- Configure MoveIt execution to use your `joint_trajectory_controller`.
- Add named poses and constrained motion test cases relevant to your workspace.

### How to test / validate
- In simulation first:
  - plan to multiple target poses
  - confirm collision avoidance and smooth trajectories
- Then on hardware (reduced speed/acceleration):
  - execute same plans
  - compare planned path vs measured joint tracking
- Exit criterion: operator can request a target pose and arm executes a valid planned trajectory safely.

---

## 6. Safety and Commissioning

### Encoder zeroing
- Perform zeroing with no payload and known mechanical fixture/reference.
- For each joint:
  - move slowly to mechanical reference mark
  - read encoder
  - store zero offset
  - verify commanded zero equals physical reference after reboot
- Keep a calibration record per joint (date, offset, operator, notes).
- Treat any offset jump as a fault condition until revalidated.

### PID / gain tuning strategy
- Tune one joint at a time, starting at distal lighter joints before heavy proximal joints.
- Start conservative:
  - low proportional gain
  - enough damping to prevent overshoot
  - avoid integral initially
- Procedure:
  - step input tests (small angles)
  - then larger moves
  - then gravity-loaded postures
- Add feedforward/compensation only after baseline stability is proven.
- Keep per-joint torque/current limits active during all tuning.

### Emergency stop considerations
- Implement two independent effects from E-stop:
  - hardware power interruption (via safety relay / PSU enable path)
  - software fault latch (driver and firmware stop accepting motion commands)
- E-stop must be latching and require manual reset.
- On E-stop event:
  - stop controller outputs
  - mark system state as faulted
  - require explicit re-enable sequence (not automatic recovery)

### Safe startup sequence
1. Confirm mechanical workspace is clear and payload assumptions are valid.
2. Power control electronics first (SBC + Teensy), keep actuator power disabled.
3. Bring up ROS nodes and verify communications/health.
4. Confirm E-stop status and watchdog signals are healthy.
5. Enable actuator power.
6. Read encoder states, apply zero offsets, verify joint state sanity.
7. Enable controllers in low-speed mode.
8. Execute a short low-amplitude verification trajectory before normal operation.

---

## 7. Open Technical Decisions (Must Be Resolved)

- Final kinematic baseline: **6-DOF vs 7-DOF**
  - URDF is 6-DOF; BOM/sizing describe 7-DOF.
  - MoveIt configuration and hardware mapping depend on this.

- Wrist/end-effector final design scope
  - Timeline/BOM mark wrist/gripper aspects as placeholders.
  - Collision model, payload model, and inertia values depend on final hardware.

- Real geometry and inertia fidelity
  - Current URDF uses assumed primitive geometry and estimated inertias.
  - Simulation quality and controller tuning quality depend on improving this.

- Firmware command protocol details
  - Exact command mode and message format between ROS driver and Teensy must be fixed.
  - Decide whether ROS talks directly CAN or only through Teensy abstraction.

- Homing/zeroing strategy
  - Define whether each joint uses absolute encoder reference, index pulse, or hard-stop homing.
  - This affects startup safety and repeatability.

- Controller update rates and real-time behavior
  - Decide control loop frequencies for firmware and ROS control.
  - Define acceptable latency/jitter budgets for CAN and host compute.

- Simulation stack choice and version lock
  - Choose ROS 2 distro and Gazebo flavor now and pin versions early to reduce integration churn.

- Safety case boundaries
  - Define exact stop categories, fault handling policy, and reset rules.
  - Required before any autonomous or high-speed motion testing.

---

## Practical Next Step
- Start with **Phase 1** and make a single source of truth decision on DOF count (6 or 7) before building controllers or MoveIt config.
