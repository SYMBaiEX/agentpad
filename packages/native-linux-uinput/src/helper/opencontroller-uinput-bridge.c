#include <errno.h>
#include <fcntl.h>
#include <linux/uinput.h>
#include <signal.h>
#include <stdint.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <sys/ioctl.h>
#include <unistd.h>

#define OC_XINPUT_REPORT_BYTES 12
#define OC_HID_REPORT_BYTES 13
#define OC_HID_REPORT_ID 1
#define OC_LINE_MAX 8192
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

struct oc_button_map {
  uint16_t bit;
  int code;
};

static const struct oc_button_map button_map[] = {
    {0x1000, BTN_SOUTH},      {0x2000, BTN_EAST},
    {0x4000, BTN_WEST},       {0x8000, BTN_NORTH},
    {0x0100, BTN_TL},         {0x0200, BTN_TR},
    {0x0020, BTN_SELECT},     {0x0010, BTN_START},
    {0x0040, BTN_THUMBL},     {0x0080, BTN_THUMBR},
    {0x0001, BTN_DPAD_UP},    {0x0002, BTN_DPAD_DOWN},
    {0x0004, BTN_DPAD_LEFT},  {0x0008, BTN_DPAD_RIGHT},
};

static int invert_axis(int16_t value);

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

  for (index = 0; index < sizeof(button_map) / sizeof(button_map[0]);
       index++) {
    if (ioctl(fd, UI_SET_KEYBIT, button_map[index].code) < 0) {
      return -1;
    }
  }

  if (ioctl(fd, UI_SET_ABSBIT, ABS_X) < 0 ||
      ioctl(fd, UI_SET_ABSBIT, ABS_Y) < 0 ||
      ioctl(fd, UI_SET_ABSBIT, ABS_RX) < 0 ||
      ioctl(fd, UI_SET_ABSBIT, ABS_RY) < 0 ||
      ioctl(fd, UI_SET_ABSBIT, ABS_Z) < 0 ||
      ioctl(fd, UI_SET_ABSBIT, ABS_RZ) < 0) {
    return -1;
  }

  if (set_abs(fd, ABS_X, -32768, 32767) < 0 ||
      set_abs(fd, ABS_Y, -32768, 32767) < 0 ||
      set_abs(fd, ABS_RX, -32768, 32767) < 0 ||
      set_abs(fd, ABS_RY, -32768, 32767) < 0 ||
      set_abs(fd, ABS_Z, 0, 255) < 0 ||
      set_abs(fd, ABS_RZ, 0, 255) < 0) {
    return -1;
  }

  memset(&setup, 0, sizeof(setup));
  setup.id.bustype = BUS_USB;
  setup.id.vendor = 0x4f43;
  setup.id.product = 0x0001;
  setup.id.version = 1;
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

static int apply_report(int fd, const struct oc_report *report) {
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
      emit_event(fd, EV_ABS, ABS_RZ, report->right_trigger) < 0 ||
      emit_syn(fd) < 0) {
    return -1;
  }

  return 0;
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

static int extract_xinput_report_base64(
    const char *line, uint8_t output[OC_XINPUT_REPORT_BYTES]) {
  return extract_base64_field(line, "\"reportBase64\":\"", output,
                              OC_XINPUT_REPORT_BYTES);
}

static int is_disconnect(const char *line) {
  return strstr(line, "\"type\":\"opencontroller.bridge.disconnect\"") != NULL;
}

int main(void) {
  const char *device_path = getenv("OPENCONTROLLER_UINPUT_DEVICE");
  const char *device_name = getenv("OPENCONTROLLER_UINPUT_NAME");
  char line[OC_LINE_MAX];
  int fd;
  int created = 0;

  if (device_path == NULL || device_path[0] == '\0') {
    device_path = OC_DEFAULT_DEVICE;
  }
  if (device_name == NULL || device_name[0] == '\0') {
    device_name = OC_DEFAULT_NAME;
  }

  signal(SIGINT, handle_signal);
  signal(SIGTERM, handle_signal);

  fd = open(device_path, O_WRONLY | O_NONBLOCK);
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

  while (running && fgets(line, sizeof(line), stdin) != NULL) {
    uint8_t hid_bytes[OC_HID_REPORT_BYTES];
    uint8_t xinput_bytes[OC_XINPUT_REPORT_BYTES];
    struct oc_report report;

    if (is_disconnect(line)) {
      neutralize(fd);
      break;
    }

    if (extract_hid_report_base64(line, hid_bytes) == 0) {
      if (decode_hid_report(hid_bytes, &report) < 0) {
        continue;
      }
    } else {
      if (extract_xinput_report_base64(line, xinput_bytes) < 0) {
        continue;
      }
      decode_xinput_report(xinput_bytes, &report);
    }

    if (apply_report(fd, &report) < 0) {
      fprintf(stderr, "opencontroller-uinput: failed to emit report: %s\n",
              strerror(errno));
      break;
    }
  }

  neutralize(fd);
  if (created) {
    ioctl(fd, UI_DEV_DESTROY);
  }
  close(fd);
  return 0;
}
