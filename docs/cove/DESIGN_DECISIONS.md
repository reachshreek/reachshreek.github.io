# Cove — design decisions and evidence

This record supports the portfolio documentation. It records the existing project; it does not propose hardware or firmware changes.

## As-built power clarification

Shree subsequently confirmed a 24 V system supply with four 24 V actuators and three 48 V actuators. Their ratings alternate in an ABABABA pattern, establishing A = 24 V and B = 48 V: J1/J3/J5/J7 are 24 V, and J2/J4/J6 are 48 V. DC/DC conversion supplies the higher-voltage group from the 24 V system.

This direct hardware clarification supersedes the old 48 V supply selection below. The public page and diagrams use the corrected 24 V architecture and omit unverified watchdog thresholds, protection hardware, and protocol values. Earlier source and evidence notes are retained here as development history.

## How to resolve sources

- Use `project_COVE_terra_labs-main.zip` as the technical reference when it conflicts with the generated ChatGPT summary, as instructed by Shree.
- Shree's direct build account establishes his Electrical Lead role, the ten-week build, motion across seven actuators, and the four-state firmware system.
- Shree directly confirmed the PSU choice and its low holding-power rationale.
- Preserve the distinction between repository plans and demonstrated implementation. A planning value or a checked scope item is not a measured test result.
- The generated summary contains generic recommendations and incomplete recollections. Its statements that the mechanism and controller are unknown do not override the documented arm, Teensy, Pi, and CAN architecture.

## 1. PSU instead of a battery

**Status: confirmed by Shree.**

The alternatives discussed were battery and PSU. The holding-power requirement for the water-bottle task was assessed as very low, and the team chose a PSU. This is the original rationale supplied by the project owner. No measured holding current or wattage was provided.

Using external power also avoids primary battery charging and battery-management hardware. These are engineering benefits of the choice, not additional verified reasons from the original discussion. The assessment applies to the intended task; low holding power alone does not establish the full arm's supply requirements.

The archive's BOM proposes a Mean Well NDR-480-48, rated in that document at 48 V, 10 A, and 480 W. That is supply capacity, not measured consumption. The architecture also flags motor-voltage compatibility for confirmation. The final installed supply, actual current, and protection ratings remain unverified.

There is no evidence establishing a supercapacitor as part of the power architecture.

## 2. Separate logic and switched actuator power

**Status: repository architecture; final wiring not verified.**

`MVP_architecture.md` specifies a protected supply split upstream of the actuator contactor. One path feeds logic through a DC/DC converter; the other feeds switched motor distribution. The Pi powers the Teensy over USB in that plan.

**Documented reasoning:** control electronics stay alive during an actuator-power stop, allowing fault reporting. The stop architecture combines motor-power interruption with a separate controller status signal and software fault latch.

## 3. Star motor power and a shared CAN trunk

**Status: repository topology; seven-actuator CAN integration confirmed by Shree.**

`MVP_architecture.md` specifies individually protected motor power branches, a common return, and a CANH/CANL trunk with short stubs and one 120-ohm terminator at each physical end. A CAN transceiver interfaces the Teensy to the physical bus.

**Engineering rationale:** power branches support per-actuator distribution and protection; the addressed communication trunk connects the joint nodes to a common controller interface. This explains the architecture without claiming that alternative networks were historically evaluated.

The final transceiver, pins, bitrate, and CAN address assignments are not established. Proposed IDs in the archive remain provisional.

## 4. Four distinct actuator states

**Status: confirmed by Shree; transition guards not supplied.**

The states are Off, Power available, Power on, and Movement ready. Shree designed these for additional redundancy and bug checking across the seven actuators.

**Conceptual interpretation:** power availability, energization, and permission to move are distinct conditions. Exact entry checks, exit checks, per-joint versus system-level coordination, and fault destinations must come from the firmware. The state diagram is explanatory rather than an executable state-machine specification.

## 5. Pi/ROS and Teensy responsibilities

**Status: repository architecture; integration with the ROS 2 team confirmed by Shree.**

The archived design assigns robot-level motion targets to ROS on the Pi and actuator communication/local fault handling to the Teensy, joined by USB serial. It proposes joint-state feedback and host heartbeat monitoring.

**Engineering rationale:** this divides host motion processing from the local actuator interface and makes the joint command/feedback contract explicit. No original comparison of all controller alternatives was supplied.

The architecture's 100 ms heartbeat timeout and position-error threshold above 15 degrees for over 500 ms are planned values, not verified final firmware settings. Exact serial framing and final update rates remain undocumented.

## 6. Mechanical load versus electrical demand

**Status: historical model recovered from the archive; no new measurements.**

`SIZING_README.md` describes gravity torque as `tau = m * g * r`, summed across the supported distal masses. It applies a 1.5 dynamic factor and a 2.0 safety factor for a combined 3.0 multiplier. Its 3 kg payload is a model target, not a tested rating for the finished arm.

The governing electrical relation `P = V * I` appears in the supplied summary. Converting the mechanical model into a power budget requires actuator behavior, rail current, conversion efficiency, and simultaneous load conditions. Those inputs and holding-power measurements are absent. No numeric electrical consumption has been inferred from bottle weight or supply capacity.

## Remaining evidence gaps

The ZIP includes no firmware source, custom PCB layout, electrical schematic CAD, or measured electrical test report. It includes an older six-revolute-joint URDF, differing actuator selections, planning documents, sizing scripts, and actuator CAD assets. Preserve these limitations when documenting the completed seven-DOF build.

Final fuse values, installed actuator models, supply compatibility, CAN settings, serial protocol, calibration, state transition logic, flash procedure, and measured fault-response behavior require as-built records. The generated summary supplies no additional verified implementation details for these items.
