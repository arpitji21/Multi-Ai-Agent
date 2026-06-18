import sys
import json
import os
from reportlab.lib.pagesizes import letter
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib import colors
from reportlab.lib.units import inch

def generate_pdf(data, output_path):
    doc = SimpleDocTemplate(output_path, pagesize=letter)
    styles = getSampleStyleSheet()
    
    # Custom styles
    title_style = ParagraphStyle(
        'TitleStyle',
        parent=styles['Heading1'],
        fontSize=24,
        textColor=colors.HexColor("#ED2024"),
        alignment=1,
        spaceAfter=20
    )
    
    header_style = ParagraphStyle(
        'HeaderStyle',
        parent=styles['Heading2'],
        fontSize=12,
        textColor=colors.white,
        spaceBefore=10,
        spaceAfter=10,
        borderPadding=5,
        backColor=colors.HexColor("#333333")
    )

    label_style = ParagraphStyle(
        'LabelStyle',
        parent=styles['Normal'],
        fontSize=10,
        fontName='Helvetica-Bold'
    )

    content = []

    # Title
    content.append(Paragraph("MediAI Hospital EMR Report", title_style))
    content.append(Spacer(1, 12))

    # Patient & Doctor Info
    info_data = [
        [Paragraph("Patient Name:", label_style), data.get('patient_name', 'N/A'), Paragraph("Doctor Name:", label_style), data.get('doctor_name', 'N/A')],
        [Paragraph("Date:", label_style), (data.get('created_at', 'N/A')[:10] if data.get('created_at') else 'N/A'), Paragraph("Specialization:", label_style), data.get('specialization', 'N/A')],
    ]
    
    t = Table(info_data, colWidths=[1.2*inch, 2.3*inch, 1.2*inch, 2.3*inch])
    t.setStyle(TableStyle([
        ('GRID', (0,0), (-1,-1), 0.5, colors.lightgrey),
        ('VALIGN', (0,0), (-1,-1), 'MIDDLE'),
        ('BOTTOMPADDING', (0,0), (-1,-1), 6),
        ('TOPPADDING', (0,0), (-1,-1), 6),
    ]))
    content.append(t)
    content.append(Spacer(1, 20))

    # Vitals if available
    vitals = data.get('vital_signs')
    if vitals:
        if isinstance(vitals, str):
            try:
                vitals = json.loads(vitals)
            except:
                vitals = None
        
        if vitals and any(vitals.values()):
            content.append(Paragraph("VITAL SIGNS", header_style))
            v_data = [
                [Paragraph("Blood Pressure", label_style), Paragraph("Temperature", label_style), Paragraph("Heart Rate", label_style)],
                [f"{vitals.get('bp', '—')} mmHg", f"{vitals.get('temp', '—')} °F", f"{vitals.get('pulse', '—')} bpm"]
            ]
            vt = Table(v_data, colWidths=[2.33*inch, 2.33*inch, 2.33*inch])
            vt.setStyle(TableStyle([
                ('GRID', (0,0), (-1,-1), 0.5, colors.lightgrey),
                ('ALIGN', (0,0), (-1,-1), 'CENTER'),
                ('BACKGROUND', (0,0), (-1,0), colors.whitesmoke),
            ]))
            content.append(vt)
            content.append(Spacer(1, 15))

    # Diagnosis
    content.append(Paragraph("DIAGNOSIS", header_style))
    content.append(Paragraph(data.get('diagnosis') or 'No diagnosis recorded.', styles['Normal']))
    content.append(Spacer(1, 15))

    # Clinical Notes
    if data.get('notes'):
        content.append(Paragraph("CLINICAL NOTES", header_style))
        content.append(Paragraph(data.get('notes').replace('\n', '<br/>'), styles['Normal']))
        content.append(Spacer(1, 15))

    # Treatment Plan
    content.append(Paragraph("TREATMENT PLAN", header_style))
    content.append(Paragraph(data.get('treatment_plan') or 'No treatment plan recorded.', styles['Normal']))
    content.append(Spacer(1, 15))

    # Prescriptions
    content.append(Paragraph("PRESCRIBED MEDICATIONS", header_style))
    prescription = data.get('prescription') or 'No medications prescribed.'
    content.append(Paragraph(prescription.replace('\n', '<br/>'), styles['Normal']))
    content.append(Spacer(1, 15))

    # Follow-up
    if data.get('follow_up_date'):
        content.append(Paragraph("FOLLOW-UP INSTRUCTIONS", header_style))
        f_date = data.get('follow_up_date')
        content.append(Paragraph(f"<b>Scheduled Follow-up:</b> {f_date[:10]}", styles['Normal']))
        content.append(Spacer(1, 15))

    # Footer
    content.append(Spacer(1, 0.5*inch))
    footer_text = "This is a computer-generated EMR report from MediAI Hospital Suite. Please consult your physician for any medical advice."
    content.append(Paragraph(footer_text, ParagraphStyle('Footer', parent=styles['Italic'], fontSize=8, textColor=colors.grey, alignment=1)))

    doc.build(content)

if __name__ == "__main__":
    if len(sys.argv) < 3:
        print("Usage: python generate_pdf.py <json_data> <output_path>")
        sys.exit(1)
    
    try:
        data_json = sys.argv[1]
        out_path = sys.argv[2]
        data = json.loads(data_json)
        generate_pdf(data, out_path)
        print(f"SUCCESS:{out_path}")
    except Exception as e:
        print(f"ERROR:{str(e)}")
        sys.exit(1)
