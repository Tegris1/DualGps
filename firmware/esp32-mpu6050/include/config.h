#pragma once

// PlatformIO selects these separately for the three boards. For an Arduino IDE
// build, define IMU_SECTION as 1 (boom), 2 (arm/stick), or 3 (bucket).
#ifndef IMU_SECTION
#error "Select a section: build environment boom, arm, or bucket"
#endif

#if IMU_SECTION == 1
constexpr const char *SECTION_ID = "boom";
#elif IMU_SECTION == 2
constexpr const char *SECTION_ID = "arm";
#elif IMU_SECTION == 3
constexpr const char *SECTION_ID = "bucket";
#else
#error "IMU_SECTION must be 1, 2, or 3"
#endif

constexpr int SDA_PIN = 21;
constexpr int SCL_PIN = 22;
constexpr unsigned SAMPLE_PERIOD_MS = 10;  // 100 Hz
constexpr unsigned SEND_PERIOD_MS = 50;    // 20 Hz

// Mount X toward the next hinge/cutting edge, Y along the hinge, Z up with
// the section horizontal. Adjust the mounting offset in degrees if needed.
#ifndef IMU_ANGLE_SIGN
#define IMU_ANGLE_SIGN 1.0f
#endif
#ifndef IMU_ANGLE_OFFSET_DEG
#define IMU_ANGLE_OFFSET_DEG 0.0f
#endif
static_assert(IMU_ANGLE_SIGN == 1.0f || IMU_ANGLE_SIGN == -1.0f, "Angle sign must be +1 or -1");
