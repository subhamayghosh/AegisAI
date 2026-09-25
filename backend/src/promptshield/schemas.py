from __future__ import annotations

from datetime import datetime
from enum import Enum
from typing import Generic, TypeVar
from uuid import UUID

from pydantic import BaseModel, ConfigDict, EmailStr, Field

# ---------------------------------------------------------------------------
# Enums
# ---------------------------------------------------------------------------


class SourceType(str, Enum):
    user_message = "user_message"
    pdf = "pdf"
    email = "email"
    html = "html"
    markdown = "markdown"
    word_doc = "word_doc"
    api_response = "api_response"
    ocr_text = "ocr_text"
    source_code = "source_code"
    web_page = "web_page"
    image = "image"


class AttackType(str, Enum):
    instruction_override = "instruction_override"
    role_change = "role_change"
    secret_extraction = "secret_extraction"
    tool_abuse = "tool_abuse"
    credential_theft = "credential_theft"
    context_poisoning = "context_poisoning"
    multi_step_jailbreak = "multi_step_jailbreak"
    encoded_instructions = "encoded_instructions"
    indirect_prompt_injection = "indirect_prompt_injection"


class TierName(str, Enum):
    tier1_heuristic = "tier1_heuristic"
    tier2_semantic = "tier2_semantic"
    tier3_llm_judge = "tier3_llm_judge"


class Decision(str, Enum):
    ALLOW = "ALLOW"
    NEUTRALIZE = "NEUTRALIZE"
    BLOCK = "BLOCK"


class UserRole(str, Enum):
    user = "user"
    admin = "admin"


class Theme(str, Enum):
    light = "light"
    dark = "dark"
    auto = "auto"


# ---------------------------------------------------------------------------
# Firewall request / response (Appendix A)
# ---------------------------------------------------------------------------


class RequestMetadata(BaseModel):
    filename: str | None = None
    url: str | None = None
    content_type: str | None = None


class FirewallRequest(BaseModel):
    input_id: UUID
    session_id: UUID | None = None
    turn_id: int = Field(default=1, ge=1)
    text: str
    source_type: SourceType
    metadata: RequestMetadata = Field(default_factory=RequestMetadata)


class TierSignal(BaseModel):
    tier: TierName
    flagged: bool
    attack_type: AttackType | None = None
    confidence: float = Field(default=0.0, ge=0.0, le=1.0)
    matched_rule: str | None = None
    latency_ms: int = 0
    notes: str | None = None


class FirewallResponse(BaseModel):
    input_id: UUID
    session_id: UUID
    turn_id: int
    final_decision: Decision
    sanitized_text: str | None = None
    tier_signals: list[TierSignal] = Field(default_factory=list)
    session_suspicion_score: float = Field(default=0.0, ge=0.0, le=1.0)
    reason: str
    working_model_id: str
    judge_model_id: str
    latency_ms_total: int = 0


# ---------------------------------------------------------------------------
# User / Auth
# ---------------------------------------------------------------------------


class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    email: EmailStr
    display_name: str
    role: UserRole
    created_at: datetime
    last_login_at: datetime | None = None


class RegisterIn(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8, max_length=72)
    display_name: str = Field(min_length=1, max_length=100)


class LoginIn(BaseModel):
    email: EmailStr
    password: str


class RefreshIn(BaseModel):
    refresh_token: str


class AuthResponse(BaseModel):
    user: UserOut
    access_token: str
    refresh_token: str


class RefreshResponse(BaseModel):
    access_token: str
    refresh_token: str


class UserPatchIn(BaseModel):
    model_config = ConfigDict(extra="forbid")
    display_name: str | None = Field(default=None, min_length=1, max_length=100)


class PasswordChangeIn(BaseModel):
    current_password: str
    new_password: str = Field(min_length=8, max_length=72)


class UserSettingsIn(BaseModel):
    working_model_id: str | None = None
    judge_model_id: str | None = None
    store_raw_text_in_history: bool | None = None
    tier2_threshold: float | None = Field(default=None, ge=0.5, le=0.95)
    session_jailbreak_threshold: float | None = Field(default=None, ge=0.5, le=0.95)
    theme: Theme | None = None


class UserSettingsOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    working_model_id: str | None = None
    judge_model_id: str | None = None
    store_raw_text_in_history: bool = False
    tier2_threshold: float = 0.75
    session_jailbreak_threshold: float = 0.70
    theme: Theme = Theme.auto


class EffectiveModels(BaseModel):
    working: str
    judge: str


class UserSettingsGetOut(UserSettingsOut):
    effective: EffectiveModels


class ModelOption(BaseModel):
    id: str
    label: str
    description: str


class AvailableModelsDefaults(BaseModel):
    working: str
    judge: str


class AvailableModelsResponse(BaseModel):
    working: list[ModelOption]
    judge: list[ModelOption]
    defaults: AvailableModelsDefaults


# ---------------------------------------------------------------------------
# Inspection history
# ---------------------------------------------------------------------------


class InspectionOut(BaseModel):
    id: UUID
    input_id: UUID
    session_id: UUID | None
    source_type: SourceType
    final_decision: Decision
    attack_type: AttackType | None = None
    input_hash: str
    latency_ms_total: int
    created_at: datetime


class InspectionDetailOut(InspectionOut):
    input_text: str | None = None
    sanitized_text: str | None = None
    tier_signals: list[TierSignal] = Field(default_factory=list)
    session_suspicion_score: float = 0.0
    reason: str
    working_model_id: str
    judge_model_id: str


# ---------------------------------------------------------------------------
# Pagination wrapper
# ---------------------------------------------------------------------------

T = TypeVar("T")


class Page(BaseModel, Generic[T]):
    items: list[T]
    total: int
    page: int
    page_size: int

    @property
    def pages(self) -> int:
        if self.page_size == 0:
            return 0
        return -(-self.total // self.page_size)  # ceiling division
