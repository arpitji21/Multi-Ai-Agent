#!/bin/bash
cd frontend && npm run build
cd ../backend && gunicorn --bind=0.0.0.0:8000 --reuse-port main:app &
cd ../frontend && npx serve -s dist -l 5000
