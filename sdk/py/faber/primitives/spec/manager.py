"""
SpecManager - Framework-agnostic specification management.

Handles creation, validation, and refinement of specifications.
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field
from datetime import datetime
from pathlib import Path
from typing import Any, Optional

import yaml


@dataclass
class Specification:
    """Represents a FABER specification."""

    id: str
    path: str
    title: str
    work_id: Optional[str] = None
    template: str = "feature"
    status: str = "draft"  # draft | in_progress | complete | archived
    version: str = "1.0.0"
    content: str = ""
    metadata: dict[str, Any] = field(default_factory=dict)


@dataclass
class ValidationResult:
    """Result of specification validation."""

    status: str  # complete | partial | incomplete
    completeness: float
    missing_sections: list[str] = field(default_factory=list)
    suggestions: list[str] = field(default_factory=list)
    errors: list[str] = field(default_factory=list)


# Default templates for different work types
TEMPLATES = {
    "feature": """# {title}

## Status: Draft
## Version: 1.0.0
## Work ID: {work_id}
## Created: {created_date}

---

## 1. Summary

{context}

---

## 2. Requirements

### 2.1 Functional Requirements

- [ ] Requirement 1
- [ ] Requirement 2

### 2.2 Non-Functional Requirements

- Performance:
- Security:
- Scalability:

---

## 3. Acceptance Criteria

- [ ] Criterion 1
- [ ] Criterion 2

---

## 4. Technical Approach

### 4.1 Architecture

[Describe the technical architecture]

### 4.2 Implementation Steps

1. Step 1
2. Step 2

### 4.3 Dependencies

- Dependency 1
- Dependency 2

---

## 5. Testing Strategy

### 5.1 Unit Tests

- Test case 1
- Test case 2

### 5.2 Integration Tests

- Test scenario 1
- Test scenario 2

---

## 6. Risks and Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Risk 1 | High/Medium/Low | Mitigation strategy |

---

## 7. Changelog

### v1.0.0 ({created_date})
- Initial specification
""",

    "bug": """# Bug Fix: {title}

## Status: Draft
## Version: 1.0.0
## Work ID: {work_id}
## Created: {created_date}

---

## 1. Problem Description

{context}

### 1.1 Expected Behavior

[What should happen]

### 1.2 Actual Behavior

[What actually happens]

### 1.3 Steps to Reproduce

1. Step 1
2. Step 2
3. Observe the issue

---

## 2. Root Cause Analysis

### 2.1 Investigation

[Document investigation steps and findings]

### 2.2 Root Cause

[Identified root cause]

---

## 3. Proposed Fix

### 3.1 Solution Description

[Describe the fix]

### 3.2 Files to Modify

- `path/to/file1.py` - Description
- `path/to/file2.py` - Description

### 3.3 Implementation Steps

1. Step 1
2. Step 2

---

## 4. Acceptance Criteria

- [ ] Bug is fixed
- [ ] No regressions introduced
- [ ] Tests added/updated

---

## 5. Testing

### 5.1 Test Cases

- Test case 1: Verify fix
- Test case 2: Regression test

### 5.2 Verification Steps

1. Step 1
2. Step 2

---

## 6. Changelog

### v1.0.0 ({created_date})
- Initial specification
""",

    "infrastructure": """# Infrastructure: {title}

## Status: Draft
## Version: 1.0.0
## Work ID: {work_id}
## Created: {created_date}

---

## 1. Overview

{context}

---

## 2. Requirements

### 2.1 Infrastructure Requirements

- [ ] Requirement 1
- [ ] Requirement 2

### 2.2 Security Requirements

- [ ] Security requirement 1
- [ ] Security requirement 2

### 2.3 Compliance Requirements

- [ ] Compliance requirement 1

---

## 3. Architecture

### 3.1 Current State

[Describe current infrastructure]

### 3.2 Target State

[Describe target infrastructure]

### 3.3 Components

| Component | Purpose | Technology |
|-----------|---------|------------|
| Component 1 | Purpose | Tech |

---

## 4. Implementation Plan

### 4.1 Prerequisites

- [ ] Prerequisite 1
- [ ] Prerequisite 2

### 4.2 Steps

1. Step 1
2. Step 2

### 4.3 Rollback Plan

[Describe rollback procedure]

---

## 5. Monitoring & Alerting

### 5.1 Metrics

- Metric 1
- Metric 2

### 5.2 Alerts

- Alert condition 1
- Alert condition 2

---

## 6. Changelog

### v1.0.0 ({created_date})
- Initial specification
""",

    "api": """# API: {title}

## Status: Draft
## Version: 1.0.0
## Work ID: {work_id}
## Created: {created_date}

---

## 1. Overview

{context}

---

## 2. API Design

### 2.1 Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | /api/v1/resource | Get resource |
| POST | /api/v1/resource | Create resource |

### 2.2 Request/Response Format

#### GET /api/v1/resource

**Request:**
```json
{{}}
```

**Response:**
```json
{{
  "data": []
}}
```

---

## 3. Authentication & Authorization

### 3.1 Authentication

[Describe authentication method]

### 3.2 Authorization

[Describe authorization rules]

---

## 4. Error Handling

### 4.1 Error Codes

| Code | Message | Description |
|------|---------|-------------|
| 400 | Bad Request | Invalid input |
| 401 | Unauthorized | Authentication required |
| 404 | Not Found | Resource not found |

---

## 5. Rate Limiting

- Rate limit: X requests per minute
- Burst limit: Y requests

---

## 6. Testing

### 6.1 Test Cases

- Test case 1
- Test case 2

---

## 7. Changelog

### v1.0.0 ({created_date})
- Initial specification
""",
}


class SpecManager:
    """Framework-agnostic specification management.

    Handles creation, validation, and management of specifications
    without any LangChain dependencies.
    """

    def __init__(self, config: Optional[dict[str, Any]] = None) -> None:
        """Initialize SpecManager with optional config."""
        self.config = config or self._load_config()
        self.specs_dir = Path(self.config.get("specs_dir", "specs"))

    def _load_config(self) -> dict[str, Any]:
        """Load configuration from .faber/config.yaml."""
        faber_config = Path.cwd() / ".faber" / "config.yaml"
        if faber_config.exists():
            with open(faber_config) as f:
                full_config = yaml.safe_load(f) or {}
                return full_config.get("spec", {})

        return {
            "specs_dir": "specs",
            "id_prefix": "SPEC",
            "templates_dir": ".faber/spec-templates",
        }

    def _generate_spec_id(self) -> str:
        """Generate a new unique specification ID."""
        prefix = self.config.get("id_prefix", "SPEC")

        # Find existing specs and get next number
        existing = list(self.specs_dir.glob(f"{prefix}-*.md"))
        if not existing:
            return f"{prefix}-00001"

        # Extract numbers from existing specs
        numbers = []
        for path in existing:
            match = re.search(rf"{prefix}-(\d+)", path.name)
            if match:
                numbers.append(int(match.group(1)))

        next_num = max(numbers) + 1 if numbers else 1
        return f"{prefix}-{next_num:05d}"

    def _get_template(self, template_name: str) -> str:
        """Get a specification template."""
        # Check custom templates first
        custom_template = Path(self.config.get("templates_dir", ".faber/spec-templates")) / f"{template_name}.md"
        if custom_template.exists():
            return custom_template.read_text()

        # Use built-in template
        return TEMPLATES.get(template_name, TEMPLATES["feature"])

    def create_spec(
        self,
        title: str,
        template: str = "feature",
        work_id: Optional[str] = None,
        context: Optional[str] = None,
    ) -> Specification:
        """Create a new specification from template.

        Args:
            title: Specification title
            template: Template to use (feature, bug, infrastructure, api)
            work_id: Optional work item ID to link
            context: Optional additional context for the spec

        Returns:
            Created Specification object
        """
        spec_id = self._generate_spec_id()
        template_content = self._get_template(template)
        created_date = datetime.now().strftime("%Y-%m-%d")

        # Format the template
        content = template_content.format(
            title=title,
            work_id=work_id or "N/A",
            context=context or "No additional context provided.",
            created_date=created_date,
        )

        # Create file with work_id in name if provided
        if work_id:
            slug = re.sub(r"[^a-z0-9]+", "-", title.lower())[:50].strip("-")
            filename = f"WORK-{work_id:0>5}-{slug}.md" if work_id.isdigit() else f"WORK-{work_id}-{slug}.md"
        else:
            slug = re.sub(r"[^a-z0-9]+", "-", title.lower())[:50].strip("-")
            filename = f"{spec_id}-{slug}.md"

        path = self.specs_dir / filename
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(content)

        return Specification(
            id=spec_id,
            path=str(path),
            title=title,
            work_id=work_id,
            template=template,
            status="draft",
            version="1.0.0",
            content=content,
            metadata={"created_date": created_date},
        )

    def get_spec(self, spec_id: str) -> Specification:
        """Get a specification by ID or work ID.

        Args:
            spec_id: Spec ID (SPEC-00001) or work ID (123)

        Returns:
            Specification object
        """
        # Try to find by spec ID
        matches = list(self.specs_dir.glob(f"{spec_id}*.md"))

        # Try to find by work ID
        if not matches:
            matches = list(self.specs_dir.glob(f"WORK-{spec_id:0>5}*.md")) if spec_id.isdigit() else []

        if not matches:
            matches = list(self.specs_dir.glob(f"*{spec_id}*.md"))

        if not matches:
            raise FileNotFoundError(f"Specification not found: {spec_id}")

        path = matches[0]
        content = path.read_text()

        # Parse metadata from content
        title_match = re.search(r"^# (.+)$", content, re.MULTILINE)
        title = title_match.group(1) if title_match else path.stem

        version_match = re.search(r"## Version: (.+)$", content, re.MULTILINE)
        version = version_match.group(1) if version_match else "1.0.0"

        status_match = re.search(r"## Status: (.+)$", content, re.MULTILINE)
        status = status_match.group(1).lower() if status_match else "draft"

        work_id_match = re.search(r"## Work ID: (.+)$", content, re.MULTILINE)
        work_id = work_id_match.group(1) if work_id_match and work_id_match.group(1) != "N/A" else None

        return Specification(
            id=spec_id,
            path=str(path),
            title=title,
            work_id=work_id,
            status=status,
            version=version,
            content=content,
        )

    def update_spec(
        self,
        spec_id: str,
        content: Optional[str] = None,
        status: Optional[str] = None,
        version: Optional[str] = None,
    ) -> Specification:
        """Update an existing specification.

        Args:
            spec_id: Specification ID
            content: New content (optional)
            status: New status (optional)
            version: New version (optional)

        Returns:
            Updated Specification object
        """
        spec = self.get_spec(spec_id)
        new_content = content or spec.content

        # Update status in content
        if status:
            new_content = re.sub(
                r"## Status: .+$",
                f"## Status: {status.title()}",
                new_content,
                flags=re.MULTILINE,
            )

        # Update version in content
        if version:
            new_content = re.sub(
                r"## Version: .+$",
                f"## Version: {version}",
                new_content,
                flags=re.MULTILINE,
            )

        Path(spec.path).write_text(new_content)
        return self.get_spec(spec_id)

    def validate_spec(self, spec_id: str) -> ValidationResult:
        """Validate a specification for completeness.

        Args:
            spec_id: Specification ID

        Returns:
            ValidationResult with completeness assessment
        """
        spec = self.get_spec(spec_id)
        content = spec.content

        # Required sections for all specs
        required_sections = [
            ("## 1. Summary", "## 1. Overview", "## 1. Problem Description"),
            ("## 2. Requirements",),
            ("## 3. ", "## 4. "),  # Technical approach or similar
            ("## Acceptance Criteria", "## 4. Acceptance Criteria", "## 3. Acceptance Criteria"),
        ]

        missing = []
        for section_options in required_sections:
            found = any(section in content for section in section_options)
            if not found:
                missing.append(section_options[0])

        # Check for unchecked checkboxes (incomplete items)
        unchecked = len(re.findall(r"- \[ \]", content))
        checked = len(re.findall(r"- \[x\]", content, re.IGNORECASE))
        total_checkboxes = unchecked + checked

        # Calculate completeness
        section_completeness = 1.0 - (len(missing) / len(required_sections))
        checkbox_completeness = checked / total_checkboxes if total_checkboxes > 0 else 1.0
        completeness = (section_completeness * 0.7) + (checkbox_completeness * 0.3)

        # Determine status
        if completeness >= 0.9 and not missing:
            status = "complete"
        elif completeness >= 0.5:
            status = "partial"
        else:
            status = "incomplete"

        # Generate suggestions
        suggestions = []
        for section in missing:
            suggestions.append(f"Add section: {section}")
        if unchecked > 0:
            suggestions.append(f"Complete {unchecked} unchecked items")

        return ValidationResult(
            status=status,
            completeness=completeness,
            missing_sections=missing,
            suggestions=suggestions,
        )

    def list_specs(
        self,
        status: Optional[str] = None,
        work_id: Optional[str] = None,
    ) -> list[Specification]:
        """List specifications with optional filtering.

        Args:
            status: Filter by status
            work_id: Filter by work ID

        Returns:
            List of Specification objects
        """
        specs = []
        for path in self.specs_dir.glob("*.md"):
            try:
                spec = self.get_spec(path.stem)

                # Apply filters
                if status and spec.status.lower() != status.lower():
                    continue
                if work_id and spec.work_id != work_id:
                    continue

                specs.append(spec)
            except Exception:
                continue

        return specs

    def archive_spec(self, spec_id: str) -> Specification:
        """Archive a completed specification.

        Args:
            spec_id: Specification ID

        Returns:
            Archived Specification object
        """
        return self.update_spec(spec_id, status="archived")

    def generate_refinement_questions(self, spec_id: str) -> list[str]:
        """Generate questions to refine a specification.

        Args:
            spec_id: Specification ID

        Returns:
            List of refinement questions
        """
        spec = self.get_spec(spec_id)
        validation = self.validate_spec(spec_id)
        content = spec.content

        questions = []

        # Questions for missing sections
        for section in validation.missing_sections:
            questions.append(f"Can you provide details for {section}?")

        # Check for vague content
        vague_patterns = [
            (r"\[.+\]", "There are placeholder texts that need to be filled in"),
            (r"TODO", "There are TODO items that need to be addressed"),
            (r"TBD", "There are TBD items that need to be determined"),
        ]

        for pattern, message in vague_patterns:
            if re.search(pattern, content, re.IGNORECASE):
                questions.append(message)

        # Standard refinement questions
        standard_questions = [
            "Are there any edge cases we should consider?",
            "What are the security implications?",
            "Are there any performance requirements or constraints?",
            "What dependencies does this work have?",
            "What is the rollback strategy if something goes wrong?",
        ]

        # Only add questions not already covered by spec content
        for q in standard_questions:
            keyword = q.split()[3].lower()  # Get main keyword
            if keyword not in content.lower():
                questions.append(q)

        return questions[:10]  # Limit to 10 questions
