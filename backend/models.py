from sqlalchemy import Column, Integer, String, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from database import Base
import datetime

class Patient(Base):
    __tablename__ = "patients"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, index=True)
    age = Column(Integer)
    gender = Column(String)
    contact = Column(String)
    
    appointments = relationship("Appointment", back_populates="patient")

class Appointment(Base):
    __tablename__ = "appointments"

    id = Column(Integer, primary_key=True, index=True)
    date_time = Column(DateTime, default=datetime.datetime.utcnow)
    status = Column(String, default="Scheduled")
    patient_id = Column(Integer, ForeignKey("patients.id"))

    patient = relationship("Patient", back_populates="appointments")

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String)
    email = Column(String, unique=True, index=True)
    password = Column(String)
    role = Column(String)

    reports = relationship("Report", back_populates="user")

class Report(Base):
    __tablename__ = "reports"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    file_name = Column(String)
    extracted_text = Column(String)

    user = relationship("User", back_populates="reports")
    analysis = relationship("AIAnalysis", back_populates="report", uselist=False)

class AIAnalysis(Base):
    __tablename__ = "ai_analysis"

    id = Column(Integer, primary_key=True, index=True)
    report_id = Column(Integer, ForeignKey("reports.id"))
    patient_summary = Column(String)
    doctor_summary = Column(String)

    report = relationship("Report", back_populates="analysis")
