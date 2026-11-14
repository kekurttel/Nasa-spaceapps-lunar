"""Transport-only Scenario bridge; deliberately not an IAU_MOON SkySeries."""
import re
from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

UNVERIFIED_FRAME = "UNVERIFIED_UPSTREAM_FRAME"


class ContractModel(BaseModel):
    model_config = ConfigDict(extra="forbid", allow_inf_nan=False)


class ScenarioSite(ContractModel):
    id: str = Field(min_length=1)
    name: str = Field(min_length=1)
    latDeg: float = Field(ge=-90, le=90)
    lonDeg: float = Field(ge=-180, le=360)
    surfaceElevationM: float | None = None
    observerHeightM: float = Field(ge=0)
    kind: str = Field(min_length=1)
    sourceIds: list[str]

    @field_validator("surfaceElevationM")
    @classmethod
    def reject_elevation(cls, value):
        if value is not None:
            raise ValueError("Surface elevation is unverified; only null is supported, not an elevation override")
        return value

    @field_validator("observerHeightM")
    @classmethod
    def native_height(cls, value):
        if value != 2:
            raise ValueError("Only native 2 m observer height is supported; no height transformation available")
        return value


class Scenario(ContractModel):
    id: str = Field(min_length=1)
    site: ScenarioSite
    startUtc: str
    endUtc: str
    stepSeconds: float = Field(ge=900, le=86400)
    frame: Literal["UNVERIFIED_UPSTREAM_FRAME"] = UNVERIFIED_FRAME

    @field_validator("startUtc", "endUtc")
    @classmethod
    def full_utc(cls, value):
        if not re.fullmatch(r"\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z", value):
            raise ValueError("Full UTC timestamp required: YYYY-MM-DDTHH:MM:SS[.fraction]Z")
        datetime.fromisoformat(value.replace("Z", "+00:00"))
        return value

    @model_validator(mode="after")
    def positive_window(self):
        start = datetime.fromisoformat(self.startUtc.replace("Z", "+00:00"))
        end = datetime.fromisoformat(self.endUtc.replace("Z", "+00:00"))
        if end <= start:
            raise ValueError("endUtc must be after startUtc")
        if (end - start).total_seconds() / self.stepSeconds > 100000:
            raise ValueError("Request exceeds 100000 sample intervals")
        return self


class LocalSeries(ContractModel):
    timeUtc: list[str]
    sunElevationDeg: list[float]
    sunAzimuthDeg: list[float]
    earthElevationDeg: list[float]
    earthAzimuthDeg: list[float]
    sunHorizonDeg: list[float | None]
    earthHorizonDeg: list[float | None]
    sunVisible: list[bool]
    earthVisible: list[bool]
    sunVisibleFraction: list[float | None]
    sunRadiusDeg: list[float | None]


class LocalAnalysis(ContractModel):
    contract: Literal["local-analysis/v1"] = "local-analysis/v1"
    scenario: Scenario
    skySeriesCompatible: Literal[False] = False
    series: LocalSeries
    summary: dict[str, Any]
    provenance: dict[str, Any]
    warnings: list[str]
