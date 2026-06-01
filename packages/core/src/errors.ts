export class OpenControllerError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = "OpenControllerError";
    this.code = code;
  }
}

export class ProfileError extends OpenControllerError {
  constructor(message: string) {
    super("PROFILE_ERROR", message);
    this.name = "ProfileError";
  }
}

export class SafetyError extends OpenControllerError {
  constructor(message: string) {
    super("SAFETY_ERROR", message);
    this.name = "SafetyError";
  }
}

export class AdapterError extends OpenControllerError {
  constructor(code: string, message: string) {
    super(code, message);
    this.name = "AdapterError";
  }
}
