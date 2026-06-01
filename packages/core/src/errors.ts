export class AgentPadError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = "AgentPadError";
    this.code = code;
  }
}

export class ProfileError extends AgentPadError {
  constructor(message: string) {
    super("PROFILE_ERROR", message);
    this.name = "ProfileError";
  }
}

export class SafetyError extends AgentPadError {
  constructor(message: string) {
    super("SAFETY_ERROR", message);
    this.name = "SafetyError";
  }
}

export class AdapterError extends AgentPadError {
  constructor(code: string, message: string) {
    super(code, message);
    this.name = "AdapterError";
  }
}
