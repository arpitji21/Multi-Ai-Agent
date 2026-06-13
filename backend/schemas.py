from pydantic import BaseModel
from datetime import datetime
from typing import List, Optional

class AppointmentBase(BaseModel):
    date_time: datetime
    status: str = "Scheduled"
    patient_id: int

class AppointmentCreate(AppointmentBase):
    pass

class Appointment(AppointmentBase):
    id: int

    class Config:
        from_attributes = True

class PatientBase(BaseModel):
    name: str
    age: int
    gender: str
    contact: str

class PatientCreate(PatientBase):
    pass

class Patient(PatientBase):
    id: int
    appointments: List[Appointment] = []

    class Config:
        from_attributes = True

# User Schemas
class UserBase(BaseModel):
    name: str
    email: str
    role: str

class UserCreate(UserBase):
    password: str

class User(UserBase):
    id: int

    class Config:
        from_attributes = True

# Report Schemas
class ReportBase(BaseModel):
    file_name: str
    extracted_text: str
    user_id: int

class ReportCreate(ReportBase):
    pass

class Report(ReportBase):
    id: int

    class Config:
        from_attributes = True

# AIAnalysis Schemas
class AIAnalysisBase(BaseModel):
    report_id: int
    patient_summary: str
    doctor_summary: str

class AIAnalysisCreate(AIAnalysisBase):
    pass

class AIAnalysis(AIAnalysisBase):
    id: int

    class Config:
        from_attributes = True
