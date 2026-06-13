from fastapi import FastAPI, Depends, HTTPException
from sqlalchemy.orm import Session
from fastapi.middleware.cors import CORSMiddleware
from typing import List

import crud, models, schemas
from database import SessionLocal, engine, get_db
import fitz  # PyMuPDF
import google.generativeai as genai
import os
from dotenv import load_dotenv
from fastapi import UploadFile, File

load_dotenv()
genai.configure(api_key=os.getenv("GOOGLE_API_KEY"))

models.Base.metadata.create_all(bind=engine)

app = FastAPI(title="Healthcare API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.post("/upload-report/{user_id}", response_model=schemas.AIAnalysis)
async def upload_report(user_id: int, file: UploadFile = File(...), db: Session = Depends(get_db)):
    content = await file.read()

    doc = fitz.open(stream=content, filetype="pdf")
    text = ""
    for page in doc:
        text += page.get_text()

    report_in = schemas.ReportCreate(
        file_name=file.filename,
        extracted_text=text,
        user_id=user_id
    )
    db_report = crud.create_report(db=db, report=report_in)

    model = genai.GenerativeModel('gemini-1.5-flash')
    prompt = f"Analyze this ECG report text and provide two summaries. 1. A simple, patient-friendly explanation. 2. A technical summary for a doctor. Text: {text}"

    response = model.generate_content(prompt)
    full_response = response.text

    patient_summary = "Patient Summary: " + full_response[:len(full_response)//2]
    doctor_summary = "Doctor Summary: " + full_response[len(full_response)//2:]

    analysis_in = schemas.AIAnalysisCreate(
        report_id=db_report.id,
        patient_summary=patient_summary,
        doctor_summary=doctor_summary
    )
    db_analysis = crud.create_analysis(db=db, analysis=analysis_in)

    return db_analysis


@app.get("/reports/{user_id}", response_model=List[schemas.Report])
def get_user_reports(user_id: int, db: Session = Depends(get_db)):
    return db.query(models.Report).filter(models.Report.user_id == user_id).all()


@app.get("/analysis/{report_id}", response_model=schemas.AIAnalysis)
def get_report_analysis(report_id: int, db: Session = Depends(get_db)):
    return crud.get_analysis_by_report(db, report_id=report_id)


@app.post("/patients/", response_model=schemas.Patient)
def create_patient(patient: schemas.PatientCreate, db: Session = Depends(get_db)):
    return crud.create_patient(db=db, patient=patient)


@app.get("/patients/", response_model=List[schemas.Patient])
def read_patients(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    patients = crud.get_patients(db, skip=skip, limit=limit)
    return patients


@app.post("/appointments/", response_model=schemas.Appointment)
def create_appointment(appointment: schemas.AppointmentCreate, db: Session = Depends(get_db)):
    return crud.create_appointment(db=db, appointment=appointment)


@app.get("/appointments/", response_model=List[schemas.Appointment])
def read_appointments(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    appointments = crud.get_appointments(db, skip=skip, limit=limit)
    return appointments


@app.get("/")
def read_root():
    return {"message": "Welcome to the Healthcare API"}
