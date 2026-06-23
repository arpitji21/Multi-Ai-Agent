#!/usr/bin/env python3
"""Clinical report summarization and follow-up planning using structured lab parsing."""
import json
import re
import sys
from datetime import datetime, timedelta
from pathlib import Path

# ── Reference ranges for common lab markers ──
LAB_MARKERS = [
    {"name": "Hemoglobin", "keys": ["hemoglobin", "hgb", "hb"], "low": 12.0, "high": 17.0, "unit": "g/dL", "critical_low": 7.0, "critical_high": 20.0},
    {"name": "Glucose (Fasting)", "keys": ["glucose", "fasting glucose", "fbs", "blood sugar"], "low": 70, "high": 100, "unit": "mg/dL", "critical_low": 50, "critical_high": 400},
    {"name": "HbA1c", "keys": ["hba1c", "a1c", "glycated hemoglobin"], "low": 4.0, "high": 5.6, "unit": "%", "critical_high": 14.0},
    {"name": "Total Cholesterol", "keys": ["total cholesterol", "cholesterol total", "chol total"], "low": 0, "high": 200, "unit": "mg/dL", "critical_high": 300},
    {"name": "LDL", "keys": ["ldl", "ldl cholesterol"], "low": 0, "high": 100, "unit": "mg/dL", "critical_high": 190},
    {"name": "HDL", "keys": ["hdl", "hdl cholesterol"], "low": 40, "high": 999, "unit": "mg/dL", "critical_low": 25},
    {"name": "Triglycerides", "keys": ["triglycerides", "trig", "tg"], "low": 0, "high": 150, "unit": "mg/dL", "critical_high": 500},
    {"name": "WBC", "keys": ["wbc", "white blood cell", "leukocyte"], "low": 4000, "high": 11000, "unit": "/µL", "critical_low": 2000, "critical_high": 30000},
    {"name": "Platelets", "keys": ["platelets", "plt", "platelet count"], "low": 150000, "high": 450000, "unit": "/µL", "critical_low": 50000, "critical_high": 1000000},
    {"name": "Creatinine", "keys": ["creatinine", "creat"], "low": 0.7, "high": 1.3, "unit": "mg/dL", "critical_high": 5.0},
    {"name": "BUN", "keys": ["bun", "blood urea nitrogen", "urea"], "low": 7, "high": 20, "unit": "mg/dL", "critical_high": 100},
    {"name": "Potassium", "keys": ["potassium", "k+"], "low": 3.5, "high": 5.0, "unit": "mEq/L", "critical_low": 2.5, "critical_high": 6.5},
    {"name": "Sodium", "keys": ["sodium", "na+"], "low": 136, "high": 145, "unit": "mEq/L", "critical_low": 120, "critical_high": 160},
    {"name": "TSH", "keys": ["tsh", "thyroid stimulating hormone"], "low": 0.4, "high": 4.0, "unit": "mIU/L", "critical_low": 0.01, "critical_high": 20},
    {"name": "ALT", "keys": ["alt", "sgpt", "alanine aminotransferase"], "low": 7, "high": 56, "unit": "U/L", "critical_high": 300},
    {"name": "AST", "keys": ["ast", "sgot", "aspartate aminotransferase"], "low": 10, "high": 40, "unit": "U/L", "critical_high": 300},
    {"name": "Hemoglobin A1c", "keys": ["hemoglobin a1c"], "low": 4.0, "high": 5.6, "unit": "%", "critical_high": 14.0},
]

FOLLOWUP_GUIDELINES = {
    "hypertension": {
        "interval_days": 30,
        "tests": ["BP monitoring (home)", "Basic metabolic panel", "Lipid panel annually"],
        "monitoring": "Daily BP log; target <130/80 mmHg unless otherwise indicated",
        "lifestyle": "DASH diet, sodium <2g/day, 150 min/week moderate exercise, weight management",
        "warning_signs": "Severe headache, chest pain, vision changes, BP >180/120",
    },
    "diabetes": {
        "interval_days": 90,
        "tests": ["HbA1c", "Fasting glucose", "Urine microalbumin annually", "Foot exam"],
        "monitoring": "Daily glucose log; watch for hypoglycemia symptoms",
        "lifestyle": "Carbohydrate counting, regular exercise, medication adherence",
        "warning_signs": "Glucose <70 or >300 mg/dL, confusion, ketones, non-healing wounds",
    },
    "respiratory infection": {
        "interval_days": 14,
        "tests": ["Repeat exam if symptoms persist >10 days", "Chest X-ray if worsening"],
        "monitoring": "Temperature, oxygen saturation if available, cough severity",
        "lifestyle": "Rest, hydration, avoid smoke exposure",
        "warning_signs": "SpO2 <92%, high fever >3 days, shortness of breath at rest, hemoptysis",
    },
    "anemia": {
        "interval_days": 30,
        "tests": ["Repeat CBC", "Iron studies", "B12/folate if indicated"],
        "monitoring": "Fatigue level, pallor, exercise tolerance",
        "lifestyle": "Iron-rich diet if iron-deficiency; avoid excessive tea/coffee with meals",
        "warning_signs": "Syncope, chest pain on exertion, tachycardia at rest",
    },
    "hyperlipidemia": {
        "interval_days": 90,
        "tests": ["Lipid panel (fasting)", "LFTs if on statin"],
        "monitoring": "Muscle pain on statins, adherence to medication",
        "lifestyle": "Mediterranean diet, exercise, smoking cessation",
        "warning_signs": "Severe muscle pain, dark urine (rhabdomyolysis risk on statins)",
    },
    "default": {
        "interval_days": 30,
        "tests": ["Clinical reassessment", "Labs as clinically indicated"],
        "monitoring": "Symptom diary; contact clinic if condition worsens",
        "lifestyle": "Balanced diet, adequate sleep, follow prescribed medications",
        "warning_signs": "Sudden severe symptoms, fever >103°F, difficulty breathing, chest pain",
    },
}

CONDITION_KEYWORDS = {
    "hypertension": ["hypertension", "high blood pressure", "htn", "elevated bp"],
    "diabetes": ["diabetes", "diabetic", "type 2 dm", "type 1 dm", "hyperglycemia", "insulin"],
    "respiratory infection": ["uri", "upper respiratory", "bronchitis", "pneumonia", "cough", "pharyngitis"],
    "anemia": ["anemia", "anaemia", "low hemoglobin", "iron deficiency"],
    "hyperlipidemia": ["hyperlipidemia", "dyslipidemia", "high cholesterol", "hypercholesterolemia"],
}


def extract_text_from_file(file_path: str) -> str:
    path = Path(file_path)
    if not path.exists():
        return ""

    suffix = path.suffix.lower()
    if suffix in (".txt", ".csv"):
        return path.read_text(encoding="utf-8", errors="ignore")[:12000]

    if suffix == ".pdf":
        text_parts = []
        try:
            import pdfplumber
            with pdfplumber.open(str(path)) as pdf:
                for page in pdf.pages[:20]:
                    t = page.extract_text() or ""
                    if t.strip():
                        text_parts.append(t)
        except Exception:
            pass

        if not text_parts:
            try:
                from pypdf import PdfReader
                reader = PdfReader(str(path))
                for page in reader.pages[:20]:
                    t = page.extract_text() or ""
                    if t.strip():
                        text_parts.append(t)
            except Exception:
                pass

        return "\n".join(text_parts)[:12000]

    return ""


def parse_lab_values(text: str) -> list:
    results = []
    seen = set()
    lower = text.lower()

    for marker in LAB_MARKERS:
        if not any(k in lower for k in marker["keys"]):
            continue

        pattern = r"(?:" + "|".join(re.escape(k) for k in marker["keys"]) + r")\s*[:=\-]?\s*(\d+(?:\.\d+)?)"
        match = re.search(pattern, text, re.IGNORECASE)
        if not match:
            continue

        value = float(match.group(1))
        key = marker["name"]
        if key in seen:
            continue
        seen.add(key)

        status = "normal"
        if value < marker["low"]:
            status = "low"
        elif value > marker["high"]:
            status = "high"

        is_critical = False
        if marker.get("critical_low") is not None and value <= marker["critical_low"]:
            is_critical = True
        if marker.get("critical_high") is not None and value >= marker["critical_high"]:
            is_critical = True

        results.append({
            "marker": key,
            "value": value,
            "unit": marker["unit"],
            "reference_range": f"{marker['low']}-{marker['high']} {marker['unit']}",
            "status": status,
            "is_critical": is_critical,
        })

    return results


def summarize_report(text: str, report_type: str = "general") -> dict:
    text = (text or "").strip()
    if len(text) < 10:
        return {
            "success": False,
            "error": "Insufficient report text for analysis",
            "key_findings": [],
            "abnormal_values": [],
            "is_critical": False,
        }

    lab_values = parse_lab_values(text)
    key_findings = []
    abnormal_values = []
    is_critical = False

    for lv in lab_values:
        key_findings.append(f"{lv['marker']}: {lv['value']} {lv['unit']}")
        if lv["status"] != "normal":
            flag = "⚠ CRITICAL" if lv["is_critical"] else "Abnormal"
            abnormal_values.append(
                f"{flag} — {lv['marker']} {lv['value']} {lv['unit']} "
                f"(Ref: {lv['reference_range']}, Status: {lv['status'].upper()})"
            )
        if lv["is_critical"]:
            is_critical = True

    # Pattern-based findings
    lower = text.lower()
    if "tachycardia" in lower:
        abnormal_values.append("⚠ CRITICAL — Tachycardia mentioned in report")
        is_critical = True
    if "bradycardia" in lower:
        abnormal_values.append("Abnormal — Bradycardia mentioned in report")
    if re.search(r"spo2?\s*[:=\-]?\s*(\d+)", lower):
        m = re.search(r"spo2?\s*[:=\-]?\s*(\d+)", lower)
        spo2 = int(m.group(1))
        if spo2 < 90:
            abnormal_values.append(f"⚠ CRITICAL — SpO2 {spo2}% (<90%)")
            is_critical = True

    if not key_findings:
        key_findings.append(f"Report type: {report_type or 'general'}")
        key_findings.append("Text extracted successfully — review full report for clinical interpretation")

    clinical_impression = build_clinical_impression(lab_values, report_type, is_critical)
    recommended_actions = build_recommendations(lab_values, is_critical)

    doctor_summary = (
        f"Structured analysis ({report_type or 'general'}). "
        f"Parsed {len(lab_values)} lab marker(s). "
        f"{'CRITICAL values detected — immediate review required. ' if is_critical else ''}"
        f"Abnormal: {len([v for v in lab_values if v['status'] != 'normal'])}. "
        + clinical_impression
    )

    return {
        "success": True,
        "engine": "python_clinical_analyzer",
        "extracted_length": len(text),
        "lab_values": lab_values,
        "key_findings": key_findings,
        "abnormal_values": abnormal_values,
        "is_critical": is_critical,
        "clinical_impression": clinical_impression,
        "recommended_actions": recommended_actions,
        "doctor_summary": doctor_summary,
        "narrative": format_narrative(key_findings, abnormal_values, clinical_impression, recommended_actions, is_critical),
    }


def build_clinical_impression(lab_values, report_type, is_critical):
    if is_critical:
        return "Critical laboratory or vital sign abnormalities identified. Urgent physician review and possible intervention recommended."
    abnormals = [v for v in lab_values if v["status"] != "normal"]
    if not abnormals:
        return "No significant abnormalities detected in parsed markers. Correlate with full report and clinical presentation."
    names = ", ".join(v["marker"] for v in abnormals[:5])
    return f"Abnormal values noted for: {names}. Clinical correlation and possible repeat testing or treatment adjustment may be warranted."


def build_recommendations(lab_values, is_critical):
    actions = []
    if is_critical:
        actions.append("Immediate physician review — consider urgent notification to patient")
        actions.append("Repeat critical labs if clinically indicated")
    abnormals = [v for v in lab_values if v["status"] != "normal"]
    if any(v["marker"] in ("Glucose (Fasting)", "HbA1c") for v in abnormals):
        actions.append("Diabetes panel follow-up; HbA1c recheck in 3 months if newly elevated")
    if any("Cholesterol" in v["marker"] or v["marker"] in ("LDL", "HDL", "Triglycerides") for v in abnormals):
        actions.append("Lipid management review; lifestyle counseling or statin evaluation")
    if any(v["marker"] == "Hemoglobin" for v in abnormals):
        actions.append("Evaluate for anemia; iron studies and dietary review")
    if any(v["marker"] == "Creatinine" for v in abnormals):
        actions.append("Renal function assessment; review nephrotoxic medications")
    if not actions:
        actions.append("Discuss results with patient at next scheduled visit")
        actions.append("Continue routine preventive care and monitoring")
    return actions


def format_narrative(key_findings, abnormal_values, impression, actions, is_critical):
    lines = ["## Clinical Report Summary\n"]
    lines.append("### KEY FINDINGS")
    for f in key_findings[:10]:
        lines.append(f"• {f}")
    if abnormal_values:
        lines.append("\n### ABNORMAL VALUES")
        for a in abnormal_values:
            lines.append(f"• {a}")
    lines.append("\n### CLINICAL IMPRESSION")
    lines.append(impression)
    lines.append("\n### RECOMMENDED ACTIONS")
    for act in actions:
        lines.append(f"• {act}")
    if is_critical:
        lines.append("\n⚠ **CRITICAL VALUES DETECTED — Immediate clinical review required**")
    return "\n".join(lines)


def match_condition(diagnosis: str, treatment: str, notes: str) -> str:
    combined = f"{diagnosis} {treatment} {notes}".lower()
    for condition, keywords in CONDITION_KEYWORDS.items():
        if any(kw in combined for kw in keywords):
            return condition
    return "default"


def followup_plan(payload: dict) -> dict:
    diagnosis = payload.get("diagnosis", "")
    treatment = payload.get("treatment", "")
    notes = payload.get("notes", "")
    patient = payload.get("patient") or {}

    condition = match_condition(diagnosis, treatment, notes)
    guide = FOLLOWUP_GUIDELINES.get(condition, FOLLOWUP_GUIDELINES["default"])

    interval_days = guide["interval_days"]
    # Adjust for severity hints
    combined = f"{diagnosis} {notes}".lower()
    if any(w in combined for w in ["severe", "critical", "acute", "uncontrolled"]):
        interval_days = max(7, interval_days // 2)
    elif any(w in combined for w in ["stable", "controlled", "resolved", "mild"]):
        interval_days = min(180, int(interval_days * 1.5))

    follow_up_date = (datetime.now() + timedelta(days=interval_days)).strftime("%Y-%m-%d")

    age = patient.get("age")
    allergies = patient.get("allergies") or "none"
    patient_name = patient.get("name") or "Patient"

    narrative_lines = [
        f"## Follow-up Plan for {patient_name}\n",
        f"### RECOMMENDED FOLLOW-UP DATE",
        f"**{follow_up_date}** ({interval_days} days / ~{interval_days // 7} weeks)\n",
        f"### REQUIRED TESTS",
    ]
    for t in guide["tests"]:
        narrative_lines.append(f"• {t}")
    narrative_lines.append("\n### MONITORING PLAN")
    narrative_lines.append(guide["monitoring"])
    narrative_lines.append("\n### LIFESTYLE RECOMMENDATIONS")
    narrative_lines.append(guide["lifestyle"])
    narrative_lines.append("\n### EMERGENCY WARNING SIGNS")
    narrative_lines.append(guide["warning_signs"])

    if allergies and allergies.lower() not in ("none", "n/a", ""):
        narrative_lines.append(f"\n### ALLERGY NOTE\nReview all prescribed medications against documented allergies: {allergies}")

    if age is not None and age >= 65:
        narrative_lines.append("\n### GERIATRIC CONSIDERATION\nPatient ≥65 — consider shorter follow-up interval and medication reconciliation.")

    return {
        "success": True,
        "engine": "python_clinical_analyzer",
        "condition_matched": condition,
        "follow_up_date": follow_up_date,
        "interval_days": interval_days,
        "required_tests": guide["tests"],
        "monitoring_plan": guide["monitoring"],
        "lifestyle_recommendations": guide["lifestyle"],
        "emergency_warning_signs": guide["warning_signs"],
        "narrative": "\n".join(narrative_lines),
    }


def main():
    try:
        payload = json.loads(sys.argv[1]) if len(sys.argv) > 1 else {}
        mode = payload.get("mode", "summarize")

        if mode == "summarize":
            text = payload.get("text", "")
            if not text and payload.get("file_path"):
                text = extract_text_from_file(payload["file_path"])
            result = summarize_report(text, payload.get("report_type", "general"))
        elif mode == "followup":
            result = followup_plan(payload)
        else:
            result = {"success": False, "error": f"Unknown mode: {mode}"}

        print(json.dumps(result))
    except Exception as e:
        print(json.dumps({"success": False, "error": str(e)}))


if __name__ == "__main__":
    main()
