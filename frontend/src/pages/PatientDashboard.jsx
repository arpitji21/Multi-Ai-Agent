import React, { useState, useEffect } from 'react';
import { Upload, FileText, Brain, AlertCircle, CheckCircle2, Loader2, History } from 'lucide-react';

export default function PatientDashboard() {
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [analysis, setAnalysis] = useState(null);
  const [history, setHistory] = useState([]);
  const userId = 1;

  useEffect(() => {
    fetchHistory();
  }, []);

  const fetchHistory = async () => {
    try {
      const res = await fetch(`http://localhost:8000/reports/${userId}`);
      const data = await res.json();
      setHistory(data);
    } catch (e) {
      console.error("History fetch failed", e);
    }
  };

  const handleFileChange = (e) => {
    setFile(e.target.files[0]);
  };

  const handleUpload = async () => {
    if (!file) return;
    setUploading(true);
    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await fetch(`http://localhost:8000/upload-report/${userId}`, {
        method: 'POST',
        body: formData,
      });
      const data = await res.json();
      setAnalysis(data);
      fetchHistory();
    } catch (e) {
      console.error("Upload failed", e);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto animate-fade-in">
      <div className="mb-8">
        <h2 className="text-3xl font-bold text-white mb-2 text-glow">My Health Dashboard</h2>
        <p className="text-zinc-400">Manage your medical reports and get instant AI-powered insights.</p>
      </div>

      {/* Upload Section */}
      <div className="glass-card p-8 mb-8 relative overflow-hidden">
        <div className="absolute top-0 right-0 p-4 opacity-10">
          <Brain size={120} />
        </div>
        
        <div className="flex items-center gap-4 mb-6 relative z-10">
          <div className="p-3 bg-brand-500/20 text-brand-500 rounded-2xl border border-brand-500/30">
            <Upload size={24} />
          </div>
          <div>
            <h3 className="text-xl font-bold text-white">Upload ECG Report</h3>
            <p className="text-zinc-400">Upload your PDF report for instant explanation</p>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row items-center gap-4 relative z-10">
          <label className="w-full">
            <input 
              type="file" 
              accept=".pdf" 
              onChange={handleFileChange}
              className="block w-full text-sm text-zinc-400 file:mr-4 file:py-2.5 file:px-6 file:rounded-xl file:border-0 file:text-sm file:font-bold file:bg-white/10 file:text-white hover:file:bg-white/20 transition-all cursor-pointer"
            />
          </label>
          <button 
            onClick={handleUpload}
            disabled={!file || uploading}
            className="w-full sm:w-auto btn-primary px-8"
          >
            {uploading ? <Loader2 className="animate-spin" size={20} /> : <Brain size={20} />}
            {uploading ? 'Analyzing...' : 'Analyze Now'}
          </button>
        </div>
      </div>

      {/* Analysis Result */}
      {analysis && (
        <div className="glass-card border-brand-500/50 bg-brand-500/5 p-8 mb-8 animate-in fade-in slide-in-from-bottom-4">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2 bg-brand-500 rounded-lg shadow-lg shadow-brand-500/40">
              <CheckCircle2 size={24} className="text-white" />
            </div>
            <h3 className="text-2xl font-bold text-white">Analysis Complete</h3>
          </div>
          
          <div className="space-y-6">
            <div className="p-6 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-sm">
              <h4 className="font-bold text-brand-400 mb-3 uppercase text-xs tracking-widest flex items-center gap-2">
                <div className="h-1 w-1 rounded-full bg-brand-500" /> Patient Friendly Explanation
              </h4>
              <p className="text-lg leading-relaxed text-zinc-200">
                {analysis.patient_summary}
              </p>
            </div>
            
            <div className="p-4 border-l-2 border-white/10 bg-white/[0.02]">
              <h4 className="font-bold text-zinc-500 mb-2 text-xs uppercase tracking-wider">Clinical Notes (For Doctors)</h4>
              <p className="text-sm text-zinc-400 italic">
                {analysis.doctor_summary}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* History */}
      <div className="glass-soft p-6">
        <h3 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
          <History className="text-zinc-500" size={20} /> Recent Reports
        </h3>
        <div className="grid gap-3">
          {history.length === 0 ? (
            <div className="text-center py-12 border border-dashed border-white/10 rounded-2xl">
              <FileText className="mx-auto text-zinc-600 mb-3" size={40} />
              <p className="text-zinc-500">No reports uploaded yet.</p>
            </div>
          ) : (
            history.map((item) => (
              <div key={item.id} className="flex items-center justify-between p-4 rounded-xl bg-white/[0.03] border border-white/5 hover:bg-white/[0.06] transition-all group">
                <div className="flex items-center gap-4">
                  <div className="p-2 bg-brand-500/10 text-brand-500 rounded-lg group-hover:bg-brand-500/20 transition-colors">
                    <FileText size={20} />
                  </div>
                  <div>
                    <p className="font-medium text-zinc-200">{item.file_name}</p>
                    <p className="text-xs text-zinc-500">Report ID: #{item.id}</p>
                  </div>
                </div>
                <button 
                  onClick={async () => {
                    const res = await fetch(`http://localhost:8000/analysis/${item.id}`);
                    setAnalysis(await res.json());
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                  }}
                  className="text-brand-500 text-sm font-bold hover:text-brand-400 transition-colors px-4 py-2"
                >
                  View Details
                </button>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
