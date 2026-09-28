export const SOURCE_TYPES = [
  { value: "user_message", label: "User message" },
  { value: "pdf", label: "PDF document" },
  { value: "email", label: "Email" },
  { value: "html", label: "HTML" },
  { value: "markdown", label: "Markdown" },
  { value: "word_doc", label: "Word document" },
  { value: "api_response", label: "API response" },
  { value: "ocr_text", label: "OCR text" },
  { value: "source_code", label: "Source code" },
  { value: "web_page", label: "Web page" },
  { value: "image", label: "Image" },
];

export const ATTACK_TYPES = [
  { value: "instruction_override", label: "Instruction override" },
  { value: "role_change", label: "Role change" },
  { value: "secret_extraction", label: "Secret extraction" },
  { value: "tool_abuse", label: "Tool abuse" },
  { value: "credential_theft", label: "Credential theft" },
  { value: "context_poisoning", label: "Context poisoning" },
  { value: "multi_step_jailbreak", label: "Multi-step jailbreak" },
  { value: "encoded_instructions", label: "Encoded instructions" },
  { value: "indirect_prompt_injection", label: "Indirect prompt injection" },
];

export const ATTACK_TYPE_LABELS = Object.fromEntries(
  ATTACK_TYPES.map((a) => [a.value, a.label])
);

export const DECISIONS = ["ALLOW", "NEUTRALIZE", "BLOCK"];

export const SESSION_JAILBREAK_THRESHOLD = 0.7;
