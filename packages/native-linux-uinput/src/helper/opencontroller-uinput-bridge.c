#include <errno.h>
#include <fcntl.h>
#include <linux/uinput.h>
#include <signal.h>
#include <stdint.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <sys/ioctl.h>
#include <sys/select.h>
#include <sys/time.h>
#include <unistd.h>

#define OC_XINPUT_REPORT_BYTES 12
#define OC_HID_REPORT_BYTES 13
#define OC_HID_REPORT_ID 1
#define OC_PLAYSTATION_REPORT_BYTES 47
#define OC_PLAYSTATION_REPORT_ID 3
#define OC_PLAYSTATION_TOUCH_CONTACTS 2
#define OC_SWITCH_REPORT_BYTES 31
#define OC_SWITCH_REPORT_ID 4
#define OC_RUMBLE_REPORT_BYTES 5
#define OC_RUMBLE_REPORT_ID 2
#define OC_RUMBLE_REPORT_BASE64_BYTES 8
#define OC_LIGHT_REPORT_BYTES 7
#define OC_LIGHT_REPORT_ID 5
#define OC_LIGHT_REPORT_BASE64_BYTES 12
#define OC_MAX_FF_EFFECTS 16
#define OC_LINE_MAX 8192
#define OC_CONTROLLER_ID_MAX 256
#define OC_DEFAULT_DEVICE "/dev/uinput"
#define OC_DEFAULT_NAME "OpenController Virtual Gamepad"

static volatile sig_atomic_t running = 1;

struct oc_report {
  uint16_t buttons;
  uint8_t left_trigger;
  uint8_t right_trigger;
  int16_t left_x;
  int16_t left_y;
  int16_t right_x;
  int16_t right_y;
};

struct oc_touch_contact {
  uint8_t id;
  int active;
  uint16_t x;
  uint16_t y;
  uint8_t pressure;
};

struct oc_playstation_report {
  struct oc_report gamepad;
  int touchpad_pressed;
  struct oc_touch_contact contacts[OC_PLAYSTATION_TOUCH_CONTACTS];
};

struct oc_button_map {
  uint16_t bit;
  int code;
};

struct oc_rumble_effect {
  int active;
  uint16_t weak_magnitude;
  uint16_t strong_magnitude;
};

struct oc_led_map {
  int code;
  uint8_t player_light_mask;
  uint8_t player_index;
};

static const struct oc_button_map button_map[] = {
    {0x1000, BTN_SOUTH},      {0x2000, BTN_EAST},
    {0x4000, BTN_WEST},       {0x8000, BTN_NORTH},
    {0x0100, BTN_TL},         {0x0200, BTN_TR},
    {0x0020, BTN_SELECT},     {0x0010, BTN_START},
    {0x0400, BTN_MODE},       {0x0040, BTN_THUMBL},
    {0x0080, BTN_THUMBR},
    {0x0001, BTN_DPAD_UP},    {0x0002, BTN_DPAD_DOWN},
    {0x0004, BTN_DPAD_LEFT},  {0x0008, BTN_DPAD_RIGHT},
};

static const struct oc_led_map led_map[] = {
    {LED_NUML, 0x01, 1},
    {LED_CAPSL, 0x02, 2},
    {LED_SCROLLL, 0x04, 3},
    {LED_COMPOSE, 0x08, 4},
};

static int invert_axis(int16_t value);
static int process_bridge_line(int fd, const char *line,
                               const char *controller_id,
                               char *feedback_controller_id,
                               size_t feedback_controller_id_size,
                               int *should_stop);
static int handle_uinput_events(int fd, const char *controller_id,
                                struct oc_rumble_effect effects[],
                                size_t effect_count,
                                uint8_t *player_light_mask);
static int handle_uinput_upload(int fd, int request_id,
                                struct oc_rumble_effect effects[],
                                size_t effect_count);
static int handle_uinput_erase(int fd, int request_id,
                               struct oc_rumble_effect effects[],
                               size_t effect_count);
static int handle_uinput_playback(const struct input_event *event,
                                  const char *controller_id,
                                  const struct oc_rumble_effect effects[],
                                  size_t effect_count);
static int handle_led_event(const struct input_event *event,
                            const char *controller_id,
                            uint8_t *player_light_mask);
static void print_rumble_feedback(const char *controller_id,
                                  uint8_t weak_motor,
                                  uint8_t strong_motor);
static void print_light_feedback(const char *controller_id,
                                 uint8_t player_index,
                                 uint8_t player_light_mask);
static void encode_base64_bytes(const uint8_t *input, size_t input_length,
                                char *output, size_t output_length);
static unsigned long long timestamp_ms(void);
static void print_json_string(const char *value);
static int extract_controller_id(const char *line, char *output,
                                 size_t output_size);
static void set_feedback_controller_id(char *target, size_t target_size,
                                       const char *controller_id);

static void handle_signal(int sig) {
  (void)sig;
  running = 0;
}

static int emit_event(int fd, int type, int code, int value) {
  struct input_event event;
  memset(&event, 0, sizeof(event));
  event.type = type;
  event.code = code;
  event.value = value;
  return write(fd, &event, sizeof(event)) == (ssize_t)sizeof(event) ? 0 : -1;
}

static int emit_syn(int fd) { return emit_event(fd, EV_SYN, SYN_REPORT, 0); }

static int set_abs(int fd, int code, int min, int max) {
  struct uinput_abs_setup abs_setup;
  memset(&abs_setup, 0, sizeof(abs_setup));
  abs_setup.code = code;
  abs_setup.absinfo.minimum = min;
  abs_setup.absinfo.maximum = max;
  abs_setup.absinfo.fuzz = 0;
  abs_setup.absinfo.flat = 0;
  return ioctl(fd, UI_ABS_SETUP, &abs_setup);
}

static int setup_device(int fd, const char *name) {
  struct uinput_setup setup;
  size_t index;

  if (ioctl(fd, UI_SET_EVBIT, EV_KEY) < 0) {
    return -1;
  }
  if (ioctl(fd, UI_SET_EVBIT, EV_ABS) < 0) {
    return -1;
  }
  if (ioctl(fd, UI_SET_EVBIT, EV_FF) < 0) {
    return -1;
  }
  if (ioctl(fd, UI_SET_FFBIT, FF_RUMBLE) < 0) {
    return -1;
  }
  if (ioctl(fd, UI_SET_EVBIT, EV_LED) < 0) {
    return -1;
  }

  for (index = 0; index < sizeof(button_map) / sizeof(button_map[0]);
       index++) {
    if (ioctl(fd, UI_SET_KEYBIT, button_map[index].code) < 0) {
      return -1;
    }
  }
  for (index = 0; index < sizeof(led_map) / sizeof(led_map[0]); index++) {
    if (ioctl(fd, UI_SET_LEDBIT, led_map[index].code) < 0) {
      return -1;
    }
  }
  if (ioctl(fd, UI_SET_KEYBIT, BTN_TOUCH) < 0) {
    return -1;
  }

  if (ioctl(fd, UI_SET_ABSBIT, ABS_X) < 0 ||
      ioctl(fd, UI_SET_ABSBIT, ABS_Y) < 0 ||
      ioctl(fd, UI_SET_ABSBIT, ABS_RX) < 0 ||
      ioctl(fd, UI_SET_ABSBIT, ABS_RY) < 0 ||
      ioctl(fd, UI_SET_ABSBIT, ABS_Z) < 0 ||
      ioctl(fd, UI_SET_ABSBIT, ABS_RZ) < 0 ||
      ioctl(fd, UI_SET_ABSBIT, ABS_MT_SLOT) < 0 ||
      ioctl(fd, UI_SET_ABSBIT, ABS_MT_TRACKING_ID) < 0 ||
      ioctl(fd, UI_SET_ABSBIT, ABS_MT_POSITION_X) < 0 ||
      ioctl(fd, UI_SET_ABSBIT, ABS_MT_POSITION_Y) < 0 ||
      ioctl(fd, UI_SET_ABSBIT, ABS_MT_PRESSURE) < 0) {
    return -1;
  }

  if (set_abs(fd, ABS_X, -32768, 32767) < 0 ||
      set_abs(fd, ABS_Y, -32768, 32767) < 0 ||
      set_abs(fd, ABS_RX, -32768, 32767) < 0 ||
      set_abs(fd, ABS_RY, -32768, 32767) < 0 ||
      set_abs(fd, ABS_Z, 0, 255) < 0 ||
      set_abs(fd, ABS_RZ, 0, 255) < 0 ||
      set_abs(fd, ABS_MT_SLOT, 0, OC_PLAYSTATION_TOUCH_CONTACTS - 1) < 0 ||
      set_abs(fd, ABS_MT_TRACKING_ID, -1, 255) < 0 ||
      set_abs(fd, ABS_MT_POSITION_X, 0, 65535) < 0 ||
      set_abs(fd, ABS_MT_POSITION_Y, 0, 65535) < 0 ||
      set_abs(fd, ABS_MT_PRESSURE, 0, 255) < 0) {
    return -1;
  }

  memset(&setup, 0, sizeof(setup));
  setup.id.bustype = BUS_USB;
  setup.id.vendor = 0x4f43;
  setup.id.product = 0x0001;
  setup.id.version = 1;
  setup.ff_effects_max = OC_MAX_FF_EFFECTS;
  snprintf(setup.name, UINPUT_MAX_NAME_SIZE, "%s", name);

  if (ioctl(fd, UI_DEV_SETUP, &setup) < 0) {
    return -1;
  }
  if (ioctl(fd, UI_DEV_CREATE) < 0) {
    return -1;
  }

  usleep(250000);
  return 0;
}

static int16_t read_i16_le(const uint8_t *bytes) {
  return (int16_t)(bytes[0] | (bytes[1] << 8));
}

static uint16_t read_u16_le(const uint8_t *bytes) {
  return (uint16_t)(bytes[0] | (bytes[1] << 8));
}

static void decode_xinput_report(
    const uint8_t bytes[OC_XINPUT_REPORT_BYTES],
    struct oc_report *report) {
  report->buttons = (uint16_t)(bytes[0] | (bytes[1] << 8));
  report->left_trigger = bytes[2];
  report->right_trigger = bytes[3];
  report->left_x = read_i16_le(&bytes[4]);
  report->left_y = read_i16_le(&bytes[6]);
  report->right_x = read_i16_le(&bytes[8]);
  report->right_y = read_i16_le(&bytes[10]);
}

static int decode_hid_report(const uint8_t bytes[OC_HID_REPORT_BYTES],
                             struct oc_report *report) {
  if (bytes[0] != OC_HID_REPORT_ID) {
    return -1;
  }

  report->buttons = (uint16_t)(bytes[1] | (bytes[2] << 8));
  report->left_x = read_i16_le(&bytes[3]);
  report->left_y = read_i16_le(&bytes[5]);
  report->right_x = read_i16_le(&bytes[7]);
  report->right_y = read_i16_le(&bytes[9]);
  report->left_trigger = bytes[11];
  report->right_trigger = bytes[12];
  return 0;
}

static int decode_playstation_report(
    const uint8_t bytes[OC_PLAYSTATION_REPORT_BYTES],
    struct oc_playstation_report *report) {
  size_t index;

  if (bytes[0] != OC_PLAYSTATION_REPORT_ID) {
    return -1;
  }

  report->gamepad.buttons = read_u16_le(&bytes[1]);
  report->gamepad.left_x = read_i16_le(&bytes[3]);
  report->gamepad.left_y = read_i16_le(&bytes[5]);
  report->gamepad.right_x = read_i16_le(&bytes[7]);
  report->gamepad.right_y = read_i16_le(&bytes[9]);
  report->gamepad.left_trigger = bytes[11];
  report->gamepad.right_trigger = bytes[12];
  report->touchpad_pressed = bytes[13] != 0;

  for (index = 0; index < OC_PLAYSTATION_TOUCH_CONTACTS; index++) {
    size_t offset = 15 + index * 7;
    report->contacts[index].id = bytes[offset];
    report->contacts[index].active = bytes[offset + 1] != 0;
    report->contacts[index].x = read_u16_le(&bytes[offset + 2]);
    report->contacts[index].y = read_u16_le(&bytes[offset + 4]);
    report->contacts[index].pressure = bytes[offset + 6];
  }

  return 0;
}

static int decode_switch_report(const uint8_t bytes[OC_SWITCH_REPORT_BYTES],
                                struct oc_report *report) {
  if (bytes[0] != OC_SWITCH_REPORT_ID) {
    return -1;
  }

  report->buttons = read_u16_le(&bytes[1]);
  report->left_x = read_i16_le(&bytes[3]);
  report->left_y = read_i16_le(&bytes[5]);
  report->right_x = read_i16_le(&bytes[7]);
  report->right_y = read_i16_le(&bytes[9]);
  report->left_trigger = bytes[11];
  report->right_trigger = bytes[12];
  return 0;
}

static int apply_report_events(int fd, const struct oc_report *report) {
  size_t index;
  for (index = 0; index < sizeof(button_map) / sizeof(button_map[0]);
       index++) {
    if (emit_event(fd, EV_KEY, button_map[index].code,
                   (report->buttons & button_map[index].bit) ? 1 : 0) < 0) {
      return -1;
    }
  }

  if (emit_event(fd, EV_ABS, ABS_X, report->left_x) < 0 ||
      emit_event(fd, EV_ABS, ABS_Y, invert_axis(report->left_y)) < 0 ||
      emit_event(fd, EV_ABS, ABS_RX, report->right_x) < 0 ||
      emit_event(fd, EV_ABS, ABS_RY, invert_axis(report->right_y)) < 0 ||
      emit_event(fd, EV_ABS, ABS_Z, report->left_trigger) < 0 ||
      emit_event(fd, EV_ABS, ABS_RZ, report->right_trigger) < 0) {
    return -1;
  }

  return 0;
}

static int apply_report(int fd, const struct oc_report *report) {
  if (apply_report_events(fd, report) < 0) {
    return -1;
  }

  return emit_syn(fd);
}

static int apply_touchpad_report(
    int fd, const struct oc_playstation_report *report) {
  size_t index;
  int touch_active = report->touchpad_pressed;

  for (index = 0; index < OC_PLAYSTATION_TOUCH_CONTACTS; index++) {
    if (report->contacts[index].active) {
      touch_active = 1;
      break;
    }
  }

  if (emit_event(fd, EV_KEY, BTN_TOUCH, touch_active) < 0) {
    return -1;
  }

  for (index = 0; index < OC_PLAYSTATION_TOUCH_CONTACTS; index++) {
    const struct oc_touch_contact *contact = &report->contacts[index];

    if (emit_event(fd, EV_ABS, ABS_MT_SLOT, (int)index) < 0 ||
        emit_event(fd, EV_ABS, ABS_MT_TRACKING_ID,
                   contact->active ? contact->id : -1) < 0) {
      return -1;
    }

    if (contact->active &&
        (emit_event(fd, EV_ABS, ABS_MT_POSITION_X, contact->x) < 0 ||
         emit_event(fd, EV_ABS, ABS_MT_POSITION_Y, contact->y) < 0 ||
         emit_event(fd, EV_ABS, ABS_MT_PRESSURE, contact->pressure) < 0)) {
      return -1;
    }
  }

  return emit_syn(fd);
}

static int invert_axis(int16_t value) {
  return value <= -32768 ? 32767 : -value;
}

static int neutralize(int fd) {
  struct oc_report report;
  memset(&report, 0, sizeof(report));
  return apply_report(fd, &report);
}

static int base64_value(char c) {
  if (c >= 'A' && c <= 'Z') {
    return c - 'A';
  }
  if (c >= 'a' && c <= 'z') {
    return c - 'a' + 26;
  }
  if (c >= '0' && c <= '9') {
    return c - '0' + 52;
  }
  if (c == '+') {
    return 62;
  }
  if (c == '/') {
    return 63;
  }
  if (c == '=') {
    return -2;
  }
  return -1;
}

static int decode_base64_bytes(const char *input, uint8_t *output,
                               size_t expected_bytes) {
  int values[4];
  int value_count = 0;
  size_t output_count = 0;
  const char *cursor = input;

  while (*cursor != '\0' && *cursor != '"') {
    int value = base64_value(*cursor++);
    if (value == -1) {
      continue;
    }

    values[value_count++] = value;
    if (value_count < 4) {
      continue;
    }

    if (values[0] < 0 || values[1] < 0) {
      return -1;
    }
    if (output_count < expected_bytes) {
      output[output_count++] = (uint8_t)((values[0] << 2) | (values[1] >> 4));
    }
    if (values[2] >= 0 && output_count < expected_bytes) {
      output[output_count++] =
          (uint8_t)(((values[1] & 0x0f) << 4) | (values[2] >> 2));
    }
    if (values[3] >= 0 && output_count < expected_bytes) {
      output[output_count++] =
          (uint8_t)(((values[2] & 0x03) << 6) | values[3]);
    }

    value_count = 0;
  }

  return output_count == expected_bytes ? 0 : -1;
}

static int extract_base64_field(const char *line, const char *key,
                                uint8_t *output, size_t expected_bytes) {
  const char *start = strstr(line, key);
  if (start == NULL) {
    return -1;
  }
  start += strlen(key);
  return decode_base64_bytes(start, output, expected_bytes);
}

static int extract_hid_report_base64(
    const char *line, uint8_t output[OC_HID_REPORT_BYTES]) {
  return extract_base64_field(line, "\"hidReportBase64\":\"", output,
                              OC_HID_REPORT_BYTES);
}

static int extract_profile_hid_report_base64(const char *line, uint8_t *output,
                                             size_t expected_bytes) {
  return extract_base64_field(line, "\"profileHidReportBase64\":\"", output,
                              expected_bytes);
}

static int extract_xinput_report_base64(
    const char *line, uint8_t output[OC_XINPUT_REPORT_BYTES]) {
  return extract_base64_field(line, "\"reportBase64\":\"", output,
                              OC_XINPUT_REPORT_BYTES);
}

static int is_disconnect(const char *line) {
  return strstr(line, "\"type\":\"opencontroller.bridge.disconnect\"") != NULL;
}

static int line_matches_controller_id(const char *line,
                                      const char *controller_id) {
  const char *key = "\"controllerId\":\"";
  const char *start;
  const char *end;
  size_t id_length;

  if (controller_id == NULL || controller_id[0] == '\0') {
    return 1;
  }

  start = strstr(line, key);
  if (start == NULL) {
    return 0;
  }

  start += strlen(key);
  end = strchr(start, '"');
  if (end == NULL) {
    return 0;
  }

  id_length = (size_t)(end - start);
  return strlen(controller_id) == id_length &&
         strncmp(start, controller_id, id_length) == 0;
}

static int line_has_profile_hid_report_format(const char *line,
                                              const char *format) {
  const char *key = "\"profileHidReportFormat\":\"";
  const char *start = strstr(line, key);
  const char *end;
  size_t format_length;

  if (start == NULL || format == NULL) {
    return 0;
  }

  start += strlen(key);
  end = strchr(start, '"');
  if (end == NULL) {
    return 0;
  }

  format_length = (size_t)(end - start);
  return strlen(format) == format_length &&
         strncmp(start, format, format_length) == 0;
}

static int parse_bridge_line(const char *line, struct oc_report *report) {
  uint8_t profile_bytes[OC_PLAYSTATION_REPORT_BYTES];
  uint8_t switch_profile_bytes[OC_SWITCH_REPORT_BYTES];
  uint8_t hid_bytes[OC_HID_REPORT_BYTES];
  uint8_t xinput_bytes[OC_XINPUT_REPORT_BYTES];
  struct oc_playstation_report profile_report;

  if (line_has_profile_hid_report_format(line, "hid-playstation-extended") &&
      extract_profile_hid_report_base64(line, profile_bytes,
                                        OC_PLAYSTATION_REPORT_BYTES) == 0 &&
      decode_playstation_report(profile_bytes, &profile_report) == 0) {
    *report = profile_report.gamepad;
    return 0;
  }
  if (line_has_profile_hid_report_format(line, "hid-switch-extended") &&
      extract_profile_hid_report_base64(line, switch_profile_bytes,
                                        OC_SWITCH_REPORT_BYTES) == 0 &&
      decode_switch_report(switch_profile_bytes, report) == 0) {
    return 0;
  }
  if (extract_hid_report_base64(line, hid_bytes) == 0) {
    return decode_hid_report(hid_bytes, report);
  }
  if (extract_xinput_report_base64(line, xinput_bytes) < 0) {
    return -1;
  }

  decode_xinput_report(xinput_bytes, report);
  return 0;
}

static int parse_playstation_bridge_line(
    const char *line, struct oc_playstation_report *report) {
  uint8_t profile_bytes[OC_PLAYSTATION_REPORT_BYTES];

  if (!line_has_profile_hid_report_format(line, "hid-playstation-extended") ||
      extract_profile_hid_report_base64(line, profile_bytes,
                                        OC_PLAYSTATION_REPORT_BYTES) < 0) {
    return -1;
  }
  return decode_playstation_report(profile_bytes, report);
}

static int is_enabled_flag(const char *value) {
  return value != NULL && value[0] != '\0' && strcmp(value, "0") != 0 &&
         strcmp(value, "false") != 0 && strcmp(value, "FALSE") != 0;
}

static void print_decoded_report(const char *kind,
                                 const struct oc_report *report) {
  printf("%s buttons=0x%04x lt=%u rt=%u lx=%d ly=%d rx=%d ry=%d\n", kind,
         (unsigned int)report->buttons, (unsigned int)report->left_trigger,
         (unsigned int)report->right_trigger, report->left_x, report->left_y,
         report->right_x, report->right_y);
  fflush(stdout);
}

static void print_decoded_playstation_report(
    const char *kind, const struct oc_playstation_report *report) {
  printf(
      "%s touch=%d contact0=%u:%d:%u:%u:%u contact1=%u:%d:%u:%u:%u\n", kind,
      report->touchpad_pressed, (unsigned int)report->contacts[0].id,
      report->contacts[0].active, (unsigned int)report->contacts[0].x,
      (unsigned int)report->contacts[0].y,
      (unsigned int)report->contacts[0].pressure,
      (unsigned int)report->contacts[1].id, report->contacts[1].active,
      (unsigned int)report->contacts[1].x,
      (unsigned int)report->contacts[1].y,
      (unsigned int)report->contacts[1].pressure);
  fflush(stdout);
}

static int run_dry_run(const char *controller_id) {
  char line[OC_LINE_MAX];

  while (fgets(line, sizeof(line), stdin) != NULL) {
    struct oc_report report;
    struct oc_playstation_report playstation_report;

    if (!line_matches_controller_id(line, controller_id)) {
      continue;
    }

    if (is_disconnect(line)) {
      memset(&report, 0, sizeof(report));
      print_decoded_report("disconnect", &report);
      break;
    }

    if (parse_bridge_line(line, &report) < 0) {
      continue;
    }

    print_decoded_report("state", &report);
    if (parse_playstation_bridge_line(line, &playstation_report) == 0) {
      print_decoded_playstation_report("profile", &playstation_report);
    }
  }

  return 0;
}

static int process_bridge_line(int fd, const char *line,
                               const char *controller_id,
                               char *feedback_controller_id,
                               size_t feedback_controller_id_size,
                               int *should_stop) {
  struct oc_report report;
  struct oc_playstation_report playstation_report;

  *should_stop = 0;
  if (!line_matches_controller_id(line, controller_id)) {
    return 0;
  }

  if (extract_controller_id(line, feedback_controller_id,
                            feedback_controller_id_size) < 0) {
    set_feedback_controller_id(feedback_controller_id,
                               feedback_controller_id_size, controller_id);
  }

  if (is_disconnect(line)) {
    *should_stop = 1;
    return neutralize(fd);
  }

  if (parse_bridge_line(line, &report) < 0) {
    return 0;
  }

  if (parse_playstation_bridge_line(line, &playstation_report) == 0) {
    if (apply_report_events(fd, &report) < 0) {
      return -1;
    }
    return apply_touchpad_report(fd, &playstation_report);
  }

  return apply_report(fd, &report);
}

static int handle_uinput_events(int fd, const char *controller_id,
                                struct oc_rumble_effect effects[],
                                size_t effect_count,
                                uint8_t *player_light_mask) {
  for (;;) {
    struct input_event event;
    ssize_t bytes_read = read(fd, &event, sizeof(event));

    if (bytes_read == (ssize_t)sizeof(event)) {
      if (event.type == EV_UINPUT && event.code == UI_FF_UPLOAD) {
        if (handle_uinput_upload(fd, event.value, effects, effect_count) < 0) {
          return -1;
        }
      } else if (event.type == EV_UINPUT && event.code == UI_FF_ERASE) {
        if (handle_uinput_erase(fd, event.value, effects, effect_count) < 0) {
          return -1;
        }
      } else if (event.type == EV_FF) {
        if (handle_uinput_playback(&event, controller_id, effects,
                                   effect_count) < 0) {
          return -1;
        }
      } else if (event.type == EV_LED) {
        if (handle_led_event(&event, controller_id, player_light_mask) < 0) {
          return -1;
        }
      }
      continue;
    }

    if (bytes_read < 0 && (errno == EAGAIN || errno == EWOULDBLOCK)) {
      return 0;
    }
    if (bytes_read < 0 && errno == EINTR) {
      continue;
    }
    if (bytes_read == 0) {
      return 0;
    }
    return -1;
  }
}

static int handle_uinput_upload(int fd, int request_id,
                                struct oc_rumble_effect effects[],
                                size_t effect_count) {
  struct uinput_ff_upload upload;
  int effect_id;

  memset(&upload, 0, sizeof(upload));
  upload.request_id = (uint32_t)request_id;
  upload.retval = 0;

  if (ioctl(fd, UI_BEGIN_FF_UPLOAD, &upload) < 0) {
    return -1;
  }

  effect_id = upload.effect.id;
  if (upload.effect.type != FF_RUMBLE || effect_id < 0 ||
      (size_t)effect_id >= effect_count) {
    upload.retval = -EINVAL;
  } else {
    effects[effect_id].active = 1;
    effects[effect_id].weak_magnitude =
        upload.effect.u.rumble.weak_magnitude;
    effects[effect_id].strong_magnitude =
        upload.effect.u.rumble.strong_magnitude;
  }

  if (ioctl(fd, UI_END_FF_UPLOAD, &upload) < 0) {
    return -1;
  }

  return 0;
}

static int handle_uinput_erase(int fd, int request_id,
                               struct oc_rumble_effect effects[],
                               size_t effect_count) {
  struct uinput_ff_erase erase;

  memset(&erase, 0, sizeof(erase));
  erase.request_id = (uint32_t)request_id;
  erase.retval = 0;

  if (ioctl(fd, UI_BEGIN_FF_ERASE, &erase) < 0) {
    return -1;
  }

  if (erase.effect_id < effect_count) {
    memset(&effects[erase.effect_id], 0, sizeof(effects[erase.effect_id]));
  }

  if (ioctl(fd, UI_END_FF_ERASE, &erase) < 0) {
    return -1;
  }

  return 0;
}

static int handle_uinput_playback(const struct input_event *event,
                                  const char *controller_id,
                                  const struct oc_rumble_effect effects[],
                                  size_t effect_count) {
  const struct oc_rumble_effect *effect;
  uint8_t weak_motor = 0;
  uint8_t strong_motor = 0;

  if ((size_t)event->code >= effect_count) {
    return 0;
  }

  effect = &effects[event->code];
  if (effect->active && event->value != 0) {
    weak_motor = (uint8_t)(effect->weak_magnitude / 257U);
    strong_motor = (uint8_t)(effect->strong_magnitude / 257U);
  }

  print_rumble_feedback(controller_id, weak_motor, strong_motor);
  return 0;
}

static int handle_led_event(const struct input_event *event,
                            const char *controller_id,
                            uint8_t *player_light_mask) {
  size_t index;

  if (player_light_mask == NULL) {
    return 0;
  }

  for (index = 0; index < sizeof(led_map) / sizeof(led_map[0]); index++) {
    if (event->code != led_map[index].code) {
      continue;
    }

    if (event->value != 0) {
      *player_light_mask |= led_map[index].player_light_mask;
    } else {
      *player_light_mask &= (uint8_t)~led_map[index].player_light_mask;
    }

    print_light_feedback(controller_id, led_map[index].player_index,
                         *player_light_mask);
    return 0;
  }

  return 0;
}

static void print_rumble_feedback(const char *controller_id,
                                  uint8_t weak_motor,
                                  uint8_t strong_motor) {
  uint8_t report[OC_RUMBLE_REPORT_BYTES] = {
      OC_RUMBLE_REPORT_ID, weak_motor, strong_motor, 0x00, 0x00};
  char report_base64[OC_RUMBLE_REPORT_BASE64_BYTES + 1];

  encode_base64_bytes(report, sizeof(report), report_base64,
                      sizeof(report_base64));

  printf(
      "{\"type\":\"opencontroller.bridge.feedback\",\"version\":1,"
      "\"controllerId\":\"");
  print_json_string(controller_id);
  printf(
      "\",\"timestamp\":%llu,\"feedbackType\":\"rumble\","
      "\"reportFormat\":\"hid-gamepad-rumble\",\"reportId\":%u,"
      "\"reportBase64\":\"%s\",\"weakMotor\":%.6f,\"strongMotor\":%.6f,"
      "\"leftTriggerMotor\":0.000000,\"rightTriggerMotor\":0.000000}\n",
      timestamp_ms(), (unsigned int)OC_RUMBLE_REPORT_ID, report_base64,
      (double)weak_motor / 255.0, (double)strong_motor / 255.0);
  fflush(stdout);
}

static void print_light_feedback(const char *controller_id,
                                 uint8_t player_index,
                                 uint8_t player_light_mask) {
  uint8_t brightness = player_light_mask == 0 ? 0x00 : 0xff;
  uint8_t report[OC_LIGHT_REPORT_BYTES] = {
      OC_LIGHT_REPORT_ID, 0x00, 0x00, 0x00,
      brightness,         player_index, player_light_mask};
  char report_base64[OC_LIGHT_REPORT_BASE64_BYTES + 1];

  encode_base64_bytes(report, sizeof(report), report_base64,
                      sizeof(report_base64));

  printf(
      "{\"type\":\"opencontroller.bridge.feedback\",\"version\":1,"
      "\"controllerId\":\"");
  print_json_string(controller_id);
  printf(
      "\",\"timestamp\":%llu,\"feedbackType\":\"lights\","
      "\"reportFormat\":\"hid-gamepad-lights\",\"reportId\":%u,"
      "\"reportBase64\":\"%s\",\"red\":0.000000,\"green\":0.000000,"
      "\"blue\":0.000000,\"brightness\":%.6f,\"playerIndex\":%u,"
      "\"playerLightMask\":%u}\n",
      timestamp_ms(), (unsigned int)OC_LIGHT_REPORT_ID, report_base64,
      (double)brightness / 255.0, (unsigned int)player_index,
      (unsigned int)player_light_mask);
  fflush(stdout);
}

static void encode_base64_bytes(const uint8_t *input, size_t input_length,
                                char *output, size_t output_length) {
  static const char alphabet[] =
      "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
  size_t input_index = 0;
  size_t output_index = 0;

  while (input_index < input_length && output_index + 4 < output_length) {
    size_t chunk_start = input_index;
    uint32_t octet_a = input[input_index++];
    uint32_t octet_b = input_index < input_length ? input[input_index++] : 0;
    uint32_t octet_c = input_index < input_length ? input[input_index++] : 0;
    uint32_t triple = (octet_a << 16) | (octet_b << 8) | octet_c;
    size_t chunk_length = input_length - chunk_start;

    if (chunk_length > 3) {
      chunk_length = 3;
    }

    output[output_index++] = alphabet[(triple >> 18) & 0x3f];
    output[output_index++] = alphabet[(triple >> 12) & 0x3f];
    output[output_index++] =
        chunk_length > 1 ? alphabet[(triple >> 6) & 0x3f] : '=';
    output[output_index++] =
        chunk_length > 2 ? alphabet[triple & 0x3f] : '=';
  }

  if (output_length > 0) {
    output[output_index < output_length ? output_index : output_length - 1] =
        '\0';
  }
}

static unsigned long long timestamp_ms(void) {
  struct timeval value;
  gettimeofday(&value, NULL);
  return ((unsigned long long)value.tv_sec * 1000ULL) +
         ((unsigned long long)value.tv_usec / 1000ULL);
}

static void print_json_string(const char *value) {
  const unsigned char *cursor = (const unsigned char *)value;

  if (cursor == NULL) {
    return;
  }

  while (*cursor != '\0') {
    unsigned char c = *cursor++;
    switch (c) {
    case '"':
      fputc('\\', stdout);
      fputc('"', stdout);
      break;
    case '\\':
      fputs("\\\\", stdout);
      break;
    case '\b':
      fputs("\\b", stdout);
      break;
    case '\f':
      fputs("\\f", stdout);
      break;
    case '\n':
      fputs("\\n", stdout);
      break;
    case '\r':
      fputs("\\r", stdout);
      break;
    case '\t':
      fputs("\\t", stdout);
      break;
    default:
      if (c < 0x20) {
        printf("\\u%04x", (unsigned int)c);
      } else {
        fputc(c, stdout);
      }
      break;
    }
  }
}

static int extract_controller_id(const char *line, char *output,
                                 size_t output_size) {
  const char *key = "\"controllerId\":\"";
  const char *start = strstr(line, key);
  const char *end;
  size_t id_length;

  if (start == NULL || output_size == 0) {
    return -1;
  }

  start += strlen(key);
  end = strchr(start, '"');
  if (end == NULL) {
    return -1;
  }

  id_length = (size_t)(end - start);
  if (id_length >= output_size) {
    id_length = output_size - 1;
  }

  memcpy(output, start, id_length);
  output[id_length] = '\0';
  return 0;
}

static void set_feedback_controller_id(char *target, size_t target_size,
                                       const char *controller_id) {
  if (target_size == 0) {
    return;
  }

  if (controller_id == NULL || controller_id[0] == '\0') {
    controller_id = "player-1";
  }

  snprintf(target, target_size, "%s", controller_id);
}

int main(int argc, char **argv) {
  const char *device_path = getenv("OPENCONTROLLER_UINPUT_DEVICE");
  const char *device_name = getenv("OPENCONTROLLER_UINPUT_NAME");
  const char *controller_id = getenv("OPENCONTROLLER_CONTROLLER_ID");
  const char *controller_id_arg = "--controller-id=";
  int dry_run = is_enabled_flag(getenv("OPENCONTROLLER_UINPUT_DRY_RUN"));
  int arg_index;
  char line[OC_LINE_MAX];
  size_t line_length = 0;
  int stdin_open = 1;
  int fd;
  int created = 0;
  struct oc_rumble_effect effects[OC_MAX_FF_EFFECTS];
  char feedback_controller_id[OC_CONTROLLER_ID_MAX];
  uint8_t player_light_mask = 0;

  for (arg_index = 1; arg_index < argc; arg_index++) {
    if (strcmp(argv[arg_index], "--dry-run") == 0) {
      dry_run = 1;
      continue;
    }

    if (strcmp(argv[arg_index], "--controller-id") == 0) {
      if (arg_index + 1 >= argc || argv[arg_index + 1][0] == '\0') {
        fprintf(stderr,
                "opencontroller-uinput: --controller-id requires a value\n");
        return 2;
      }

      controller_id = argv[++arg_index];
      continue;
    }

    if (strncmp(argv[arg_index], controller_id_arg, strlen(controller_id_arg)) ==
        0) {
      controller_id = argv[arg_index] + strlen(controller_id_arg);
      if (controller_id[0] == '\0') {
        fprintf(stderr,
                "opencontroller-uinput: --controller-id requires a value\n");
        return 2;
      }
      continue;
    }

    fprintf(stderr, "opencontroller-uinput: unknown argument: %s\n",
            argv[arg_index]);
    return 2;
  }

  if (dry_run) {
    return run_dry_run(controller_id);
  }

  if (device_path == NULL || device_path[0] == '\0') {
    device_path = OC_DEFAULT_DEVICE;
  }
  if (device_name == NULL || device_name[0] == '\0') {
    device_name = OC_DEFAULT_NAME;
  }

  signal(SIGINT, handle_signal);
  signal(SIGTERM, handle_signal);

  memset(effects, 0, sizeof(effects));
  set_feedback_controller_id(feedback_controller_id,
                             sizeof(feedback_controller_id), controller_id);

  fd = open(device_path, O_RDWR | O_NONBLOCK);
  if (fd < 0) {
    fprintf(stderr, "opencontroller-uinput: failed to open %s: %s\n",
            device_path, strerror(errno));
    return 1;
  }

  if (setup_device(fd, device_name) < 0) {
    fprintf(stderr, "opencontroller-uinput: failed to create device: %s\n",
            strerror(errno));
    close(fd);
    return 1;
  }
  created = 1;

  while (running && stdin_open) {
    fd_set read_fds;
    int selected;
    int should_stop = 0;

    FD_ZERO(&read_fds);
    FD_SET(STDIN_FILENO, &read_fds);
    FD_SET(fd, &read_fds);

    selected = select(fd + 1, &read_fds, NULL, NULL, NULL);
    if (selected < 0) {
      if (errno == EINTR) {
        continue;
      }
      fprintf(stderr, "opencontroller-uinput: select failed: %s\n",
              strerror(errno));
      break;
    }

    if (FD_ISSET(fd, &read_fds) &&
        handle_uinput_events(fd, feedback_controller_id, effects,
                             OC_MAX_FF_EFFECTS, &player_light_mask) < 0) {
      fprintf(stderr, "opencontroller-uinput: failed to handle output event: %s\n",
              strerror(errno));
      break;
    }

    if (FD_ISSET(STDIN_FILENO, &read_fds)) {
      char buffer[1024];
      ssize_t bytes_read = read(STDIN_FILENO, buffer, sizeof(buffer));
      ssize_t offset;

      if (bytes_read == 0) {
        stdin_open = 0;
      } else if (bytes_read < 0) {
        if (errno == EINTR || errno == EAGAIN || errno == EWOULDBLOCK) {
          continue;
        }
        fprintf(stderr, "opencontroller-uinput: failed to read stdin: %s\n",
                strerror(errno));
        break;
      }

      for (offset = 0; offset < bytes_read; offset++) {
        char c = buffer[offset];
        if (c == '\n') {
          line[line_length] = '\0';
          if (process_bridge_line(fd, line, controller_id,
                                  feedback_controller_id,
                                  sizeof(feedback_controller_id),
                                  &should_stop) < 0) {
            fprintf(stderr,
                    "opencontroller-uinput: failed to emit report: %s\n",
                    strerror(errno));
            running = 0;
            break;
          }
          line_length = 0;
          if (should_stop) {
            stdin_open = 0;
            break;
          }
          continue;
        }

        if (line_length + 1 < sizeof(line)) {
          line[line_length++] = c;
        }
      }
    }
  }

  if (line_length > 0 && running) {
    int should_stop = 0;
    line[line_length] = '\0';
    if (process_bridge_line(fd, line, controller_id, feedback_controller_id,
                            sizeof(feedback_controller_id), &should_stop) < 0) {
      fprintf(stderr, "opencontroller-uinput: failed to emit report: %s\n",
              strerror(errno));
    }
  }

  neutralize(fd);
  if (created) {
    ioctl(fd, UI_DEV_DESTROY);
  }
  close(fd);
  return 0;
}
