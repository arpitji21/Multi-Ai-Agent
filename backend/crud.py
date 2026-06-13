from sqlalchemy.orm import Session
import models, schemas

def get_patients(db: Session, skip: int = 0, limit: int = 100):
    return db.query(models.Patient).offset(skip).limit(limit).all()

def create_patient(db: Session, patient: schemas.PatientCreate):
    db_patient = models.Patient(**patient.dict())
    db.add(db_patient)
    db.commit()
    db.refresh(db_patient)
    return db_patient

def get_appointments(db: Session, skip: int = 0, limit: int = 100):
    return db.query(models.Appointment).offset(skip).limit(limit).all()

def create_appointment(db: Session, appointment: schemas.AppointmentCreate):
    db_appointment = models.Appointment(**appointment.dict())
    db.add(db_appointment)
    db.commit()
    db.refresh(db_appointment)
    return db_appointment

# User CRUD
def get_user(db: Session, user_id: int):
    return db.query(models.User).filter(models.User.id == user_id).first()

def get_user_by_email(db: Session, email: str):
    return db.query(models.User).filter(models.User.email == email).first()

def create_user(db: Session, user: schemas.UserCreate):
    db_user = models.User(**user.dict())
    db.add(db_user)
    db.commit()
    db.refresh(db_user)
    return db_user

# Report CRUD
def create_report(db: Session, report: schemas.ReportCreate):
    db_report = models.Report(**report.dict())
    db.add(db_report)
    db.commit()
    db.refresh(db_report)
    return db_report

def get_reports(db: Session, skip: int = 0, limit: int = 100):
    return db.query(models.Report).offset(skip).limit(limit).all()

# AIAnalysis CRUD
def create_analysis(db: Session, analysis: schemas.AIAnalysisCreate):
    db_analysis = models.AIAnalysis(**analysis.dict())
    db.add(db_analysis)
    db.commit()
    db.refresh(db_analysis)
    return db_analysis

def get_analysis_by_report(db: Session, report_id: int):
    return db.query(models.AIAnalysis).filter(models.AIAnalysis.report_id == report_id).first()
