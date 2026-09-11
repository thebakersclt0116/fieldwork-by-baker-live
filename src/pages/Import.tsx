/**
 * Data Import Page
 * Allows BCBA candidates to upload hours from other tracking platforms
 * Supports: Ripley Fieldwork Tracker, generic CSV, Excel
 */

import { useState, useRef, useCallback } from 'react';
import { motion } from 'framer-motion';
import {
  Upload,
  FileSpreadsheet,
  CheckCircle,
  AlertCircle,
  Download,
  ArrowLeft,
  Table,
  Trash2,
  Save,
} from 'lucide-react';
import { Link } from 'react-router';

/* ------------------------------------------------------------------ */
/*  SUPPORTED PLATFORMS                                                */
/* ------------------------------------------------------------------ */

const platforms = [
  {
    id: 'ripley',
    name: 'Ripley Fieldwork Tracker',
    country: 'US / Canada / Australia',
    format: 'CSV Export',
    fields: ['Date', 'Start Time', 'End Time', 'Hours', 'Type', 'Activity', 'Supervisor'],
    popular: true,
  },
  {
    id: 'generic-csv',
    name: 'Generic CSV',
    country: 'Any',
    format: 'CSV File',
    fields: ['Date', 'Hours', 'Type', 'Activity Category'],
    popular: false,
  },
  {
    id: 'excel',
    name: 'Excel Spreadsheet',
    country: 'Any',
    format: '.xlsx / .xls',
    fields: ['Any column structure'],
    popular: false,
  },
  {
    id: 'bacb-form',
    name: 'BACB Monthly Form',
    country: 'US / Canada / Australia',
    format: 'PDF or CSV',
    fields: ['Monthly summary data'],
    popular: false,
  },
];

/* ------------------------------------------------------------------ */
/*  MOCK IMPORTED DATA (for demo)                                      */
/* ------------------------------------------------------------------ */

interface ImportedEntry {
  id: string;
  date: string;
  startTime: string;
  endTime: string;
  hours: number;
  type: string;
  activity: string;
  supervisor: string;
  category: 'Unrestricted' | 'Restricted';
  status: 'pending' | 'approved' | 'error';
  errorMessage?: string;
}

const mockImportedData: ImportedEntry[] = [
  { id: '1', date: '2025-01-15', startTime: '09:00', endTime: '12:00', hours: 3, type: 'Supervised', activity: 'Observation and Data Collection', supervisor: 'Dr. Emily Chen', category: 'Unrestricted', status: 'approved' },
  { id: '2', date: '2025-01-15', startTime: '13:00', endTime: '15:30', hours: 2.5, type: 'Supervised', activity: 'Direct Therapy Implementation', supervisor: 'Dr. Emily Chen', category: 'Restricted', status: 'approved' },
  { id: '3', date: '2025-01-16', startTime: '08:30', endTime: '11:00', hours: 2.5, type: 'Supervised', activity: 'Assessment Administration', supervisor: 'Dr. Emily Chen', category: 'Unrestricted', status: 'approved' },
  { id: '4', date: '2025-01-17', startTime: '09:00', endTime: '10:00', hours: 1, type: 'Supervised', activity: 'Supervision Meeting', supervisor: 'Dr. Emily Chen', category: 'Unrestricted', status: 'approved' },
  { id: '5', date: '2025-01-18', startTime: '09:00', endTime: '13:00', hours: 4, type: 'Supervised', activity: 'Program Writing and Revision', supervisor: 'Dr. Emily Chen', category: 'Unrestricted', status: 'pending' },
  { id: '6', date: '2025-01-20', startTime: '14:00', endTime: '15:30', hours: 1.5, type: 'Supervised', activity: 'Data Graphing and Analysis', supervisor: 'Dr. Emily Chen', category: 'Unrestricted', status: 'approved' },
  { id: '7', date: '2025-01-21', startTime: '09:00', endTime: '11:00', hours: 2, type: 'Concentrated', activity: 'Parent Training Session', supervisor: 'Dr. Marcus Johnson', category: 'Unrestricted', status: 'approved' },
  { id: '8', date: '2025-01-22', startTime: '10:00', endTime: '11:00', hours: 1, type: 'Supervised', activity: '', supervisor: 'Dr. Emily Chen', category: 'Restricted', status: 'error', errorMessage: 'Missing activity description' },
];

/* ------------------------------------------------------------------ */
/*  COMPONENT                                                          */
/* ------------------------------------------------------------------ */

export default function Import() {
  const [selectedPlatform, setSelectedPlatform] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [importStage, setImportStage] = useState<'select' | 'upload' | 'review' | 'complete'>('select');
  const [entries, setEntries] = useState<ImportedEntry[]>([]);
  const [selectedEntries, setSelectedEntries] = useState<Set<string>>(new Set());
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      processFile(files[0]);
    }
  }, []);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      processFile(files[0]);
    }
  }, []);

  const processFile = (file: File) => {
    setUploadedFile(file);
    // Simulate processing delay
    setTimeout(() => {
      setEntries(mockImportedData);
      setSelectedEntries(new Set(mockImportedData.filter(e => e.status !== 'error').map(e => e.id)));
      setImportStage('review');
    }, 1500);
  };

  const toggleEntry = (id: string) => {
    const next = new Set(selectedEntries);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedEntries(next);
  };

  const toggleAll = () => {
    const validIds = entries.filter(e => e.status !== 'error').map(e => e.id);
    if (selectedEntries.size === validIds.length) {
      setSelectedEntries(new Set());
    } else {
      setSelectedEntries(new Set(validIds));
    }
  };

  const removeEntry = (id: string) => {
    setEntries(prev => prev.filter(e => e.id !== id));
    setSelectedEntries(prev => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  };

  const saveEntries = () => {
    setImportStage('complete');
  };

  const totalSelectedHours = entries
    .filter(e => selectedEntries.has(e.id))
    .reduce((sum, e) => sum + e.hours, 0);

  const approvedCount = entries.filter(e => selectedEntries.has(e.id) && e.status === 'approved').length;
  const errorCount = entries.filter(e => e.status === 'error').length;

  return (
    <div className="min-h-[100dvh] bg-[#FFFCF9] pt-[72px]">
      <div className="container-2xl py-8">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <Link
            to="/dashboard"
            className="inline-flex items-center gap-1.5 text-sm text-[#A8998E] hover:text-[#E85D70] transition-colors mb-4"
          >
            <ArrowLeft size={16} />
            Back to Dashboard
          </Link>
          <h1 className="font-serif text-3xl font-semibold text-[#332C28] mb-2">
            Import Your Hours
          </h1>
          <p className="text-[#A8998E] max-w-xl">
            Upload hours from Ripley Fieldwork Tracker, Excel, or any other BCBA tracking platform. 
            We&apos;ll automatically map and validate your data.
          </p>
        </motion.div>

        {/* Progress Steps */}
        <div className="flex items-center gap-2 mb-8">
          {[
            { id: 'select', label: 'Select Source' },
            { id: 'upload', label: 'Upload File' },
            { id: 'review', label: 'Review' },
            { id: 'complete', label: 'Complete' },
          ].map((step, i) => {
            const isActive = importStage === step.id;
            const isPast = ['select', 'upload', 'review', 'complete'].indexOf(importStage) > i;
            return (
              <div key={step.id} className="flex items-center gap-2">
                <div
                  className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors ${
                    isActive
                      ? 'bg-[#E85D70] text-white'
                      : isPast
                      ? 'bg-[#E8F5EE] text-[#7EB89A]'
                      : 'bg-[#FAF8F6] text-[#A8998E]'
                  }`}
                >
                  {isPast ? <CheckCircle size={14} className="inline mr-1" /> : null}
                  {step.label}
                </div>
                {i < 3 && <div className="w-8 h-px bg-[#F2EDEA]" />}
              </div>
            );
          })}
        </div>

        {/* STAGE 1: Select Platform */}
        {importStage === 'select' && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-6"
          >
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {platforms.map((platform) => (
                <motion.button
                  key={platform.id}
                  whileHover={{ scale: 1.01 }}
                  whileTap={{ scale: 0.99 }}
                  onClick={() => {
                    setSelectedPlatform(platform.id);
                    setImportStage('upload');
                  }}
                  className={`relative text-left p-6 rounded-2xl border-2 transition-all ${
                    selectedPlatform === platform.id
                      ? 'border-[#E85D70] bg-[#FFF5F7]'
                      : 'border-[#F2EDEA] bg-white hover:border-[#FFC1CC]'
                  }`}
                >
                  {platform.popular && (
                    <span className="absolute top-3 right-3 px-2.5 py-0.5 rounded-full bg-[#E85D70] text-white text-[10px] font-bold uppercase tracking-wider">
                      Most Popular
                    </span>
                  )}
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 rounded-xl bg-[#FFF5F7] flex items-center justify-center text-[#E85D70]">
                      <FileSpreadsheet size={24} />
                    </div>
                    <div className="flex-1">
                      <h3 className="font-semibold text-[#332C28] mb-1">{platform.name}</h3>
                      <p className="text-xs text-[#A8998E] mb-2">{platform.country} • {platform.format}</p>
                      <div className="flex flex-wrap gap-1">
                        {platform.fields.map((field) => (
                          <span key={field} className="px-2 py-0.5 rounded-md bg-[#FAF8F6] text-[#6B5D54] text-[10px]">
                            {field}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                </motion.button>
              ))}
            </div>

            {/* Template Download */}
            <div className="bg-white rounded-2xl p-6 border border-[#F2EDEA]">
              <div className="flex items-center gap-3 mb-3">
                <Download size={20} className="text-[#D4A574]" />
                <h3 className="font-semibold text-[#332C28]">Don&apos;t have an export file?</h3>
              </div>
              <p className="text-sm text-[#A8998E] mb-4">
                Download our template and paste your hours in. We accept any format — just get the data in and we&apos;ll handle the rest.
              </p>
              <button className="px-4 py-2.5 rounded-xl border-2 border-[#F2EDEA] text-sm font-medium text-[#6B5D54] hover:border-[#D4A574] hover:text-[#D4A574] transition-colors flex items-center gap-2">
                <Table size={16} />
                Download CSV Template
              </button>
            </div>
          </motion.div>
        )}

        {/* STAGE 2: Upload */}
        {importStage === 'upload' && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-6"
          >
            <button
              onClick={() => setImportStage('select')}
              className="text-sm text-[#A8998E] hover:text-[#E85D70] transition-colors"
            >
              ← Change source
            </button>

            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`relative border-3 border-dashed rounded-3xl p-12 text-center cursor-pointer transition-all ${
                isDragging
                  ? 'border-[#E85D70] bg-[#FFF5F7]'
                  : 'border-[#F2EDEA] bg-white hover:border-[#FFC1CC]'
              }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,.xlsx,.xls"
                onChange={handleFileSelect}
                className="hidden"
              />
              <div className="w-16 h-16 rounded-2xl bg-[#FFF5F7] flex items-center justify-center text-[#E85D70] mx-auto mb-4">
                <Upload size={28} />
              </div>
              <h3 className="font-semibold text-[#332C28] mb-2">
                {isDragging ? 'Drop your file here' : 'Drag & drop your file'}
              </h3>
              <p className="text-sm text-[#A8998E] mb-2">
                or click to browse
              </p>
              <p className="text-xs text-[#C4B7AD]">
                Supports CSV, Excel (.xlsx, .xls) up to 10MB
              </p>
            </div>

            {uploadedFile && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-[#E8F5EE] rounded-2xl p-4 flex items-center gap-3"
              >
                <div className="w-10 h-10 rounded-xl bg-white flex items-center justify-center text-[#7EB89A]">
                  <FileSpreadsheet size={20} />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium text-[#332C28]">{uploadedFile.name}</p>
                  <p className="text-xs text-[#7EB89A]">Processing...</p>
                </div>
                <div className="w-5 h-5 border-2 border-[#7EB89A] border-t-transparent rounded-full animate-spin" />
              </motion.div>
            )}
          </motion.div>
        )}

        {/* STAGE 3: Review */}
        {importStage === 'review' && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-6"
          >
            {/* Summary Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-white rounded-2xl p-5 border border-[#F2EDEA]">
                <p className="text-xs text-[#A8998E] uppercase tracking-wider mb-1">Total Entries</p>
                <p className="text-2xl font-bold text-[#332C28]">{entries.length}</p>
              </div>
              <div className="bg-white rounded-2xl p-5 border border-[#F2EDEA]">
                <p className="text-xs text-[#A8998E] uppercase tracking-wider mb-1">Selected Hours</p>
                <p className="text-2xl font-bold text-[#E85D70]">{totalSelectedHours.toFixed(1)}</p>
              </div>
              <div className="bg-white rounded-2xl p-5 border border-[#F2EDEA]">
                <p className="text-xs text-[#A8998E] uppercase tracking-wider mb-1">Ready</p>
                <p className="text-2xl font-bold text-[#7EB89A]">{approvedCount}</p>
              </div>
              <div className="bg-white rounded-2xl p-5 border border-[#F2EDEA]">
                <p className="text-xs text-[#A8998E] uppercase tracking-wider mb-1">Errors</p>
                <p className="text-2xl font-bold text-[#E85D70]">{errorCount}</p>
              </div>
            </div>

            {/* Review Table */}
            <div className="bg-white rounded-2xl border border-[#F2EDEA] overflow-hidden">
              <div className="px-6 py-4 border-b border-[#F2EDEA] flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={selectedEntries.size === entries.filter(e => e.status !== 'error').length && entries.filter(e => e.status !== 'error').length > 0}
                      onChange={toggleAll}
                      className="w-4 h-4 rounded border-[#F2EDEA] text-[#E85D70] focus:ring-[#E85D70]"
                    />
                    <span className="text-sm font-medium text-[#332C28]">Select All Valid</span>
                  </label>
                </div>
                <span className="text-xs text-[#A8998E]">
                  {selectedEntries.size} of {entries.length} selected
                </span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="bg-[#FAF8F6]">
                      <th className="px-4 py-3 text-left w-10"></th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-[#A8998E] uppercase">Date</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-[#A8998E] uppercase">Time</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-[#A8998E] uppercase">Hours</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-[#A8998E] uppercase">Type</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-[#A8998E] uppercase">Activity</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-[#A8998E] uppercase">Category</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-[#A8998E] uppercase">Status</th>
                      <th className="px-4 py-3 text-left w-10"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {entries.map((entry) => (
                      <tr
                        key={entry.id}
                        className={`border-t border-[#F2EDEA] ${
                          entry.status === 'error' ? 'bg-[#FFF5F7]/50' : ''
                        }`}
                      >
                        <td className="px-4 py-3">
                          {entry.status !== 'error' && (
                            <input
                              type="checkbox"
                              checked={selectedEntries.has(entry.id)}
                              onChange={() => toggleEntry(entry.id)}
                              className="w-4 h-4 rounded border-[#F2EDEA] text-[#E85D70] focus:ring-[#E85D70]"
                            />
                          )}
                        </td>
                        <td className="px-4 py-3 text-sm text-[#332C28]">{entry.date}</td>
                        <td className="px-4 py-3 text-sm text-[#6B5D54]">
                          {entry.startTime} - {entry.endTime}
                        </td>
                        <td className="px-4 py-3 text-sm font-medium text-[#332C28]">{entry.hours}</td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-0.5 rounded-md text-[10px] font-medium ${
                            entry.type === 'Concentrated'
                              ? 'bg-[#FBF3EB] text-[#D4A574]'
                              : 'bg-[#F0F7FF] text-[#5B9BD5]'
                          }`}>
                            {entry.type}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm text-[#6B5D54] max-w-[200px] truncate">
                          {entry.activity || '-'}
                        </td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-0.5 rounded-md text-[10px] font-medium ${
                            entry.category === 'Unrestricted'
                              ? 'bg-[#E8F5EE] text-[#7EB89A]'
                              : 'bg-[#FFF5F7] text-[#E85D70]'
                          }`}>
                            {entry.category}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          {entry.status === 'approved' && (
                            <span className="flex items-center gap-1 text-xs text-[#7EB89A]">
                              <CheckCircle size={12} /> Ready
                            </span>
                          )}
                          {entry.status === 'pending' && (
                            <span className="flex items-center gap-1 text-xs text-[#E8A838]">
                              <AlertCircle size={12} /> Review
                            </span>
                          )}
                          {entry.status === 'error' && (
                            <span className="flex items-center gap-1 text-xs text-[#E85D70]" title={entry.errorMessage}>
                              <AlertCircle size={12} /> Error
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <button
                            onClick={() => removeEntry(entry.id)}
                            className="p-1 text-[#C4B7AD] hover:text-[#E85D70] transition-colors"
                          >
                            <Trash2 size={14} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center justify-between">
              <button
                onClick={() => { setImportStage('upload'); setUploadedFile(null); setEntries([]); }}
                className="text-sm text-[#A8998E] hover:text-[#E85D70] transition-colors"
              >
                Upload a different file
              </button>
              <button
                onClick={saveEntries}
                disabled={selectedEntries.size === 0}
                className="btn-primary py-3 px-6 rounded-xl disabled:opacity-50"
              >
                <Save size={16} />
                Import {selectedEntries.size} Entries ({totalSelectedHours.toFixed(1)} hrs)
              </button>
            </div>
          </motion.div>
        )}

        {/* STAGE 4: Complete */}
        {importStage === 'complete' && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="text-center py-16"
          >
            <div className="w-20 h-20 rounded-full bg-[#E8F5EE] flex items-center justify-center text-[#7EB89A] mx-auto mb-6">
              <CheckCircle size={40} />
            </div>
            <h2 className="font-serif text-2xl font-semibold text-[#332C28] mb-2">
              Import Complete!
            </h2>
            <p className="text-[#A8998E] mb-8 max-w-md mx-auto">
              Successfully imported {selectedEntries.size} entries totaling {totalSelectedHours.toFixed(1)} hours. 
              Your dashboard has been updated.
            </p>
            <div className="flex items-center justify-center gap-3">
              <Link
                to="/dashboard"
                className="btn-primary py-3 px-6 rounded-xl"
              >
                Go to Dashboard
              </Link>
              <button
                onClick={() => {
                  setImportStage('select');
                  setSelectedPlatform(null);
                  setUploadedFile(null);
                  setEntries([]);
                  setSelectedEntries(new Set());
                }}
                className="px-6 py-3 rounded-xl border-2 border-[#F2EDEA] text-sm font-medium text-[#6B5D54] hover:border-[#E85D70] hover:text-[#E85D70] transition-colors"
              >
                Import Another File
              </button>
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
}
