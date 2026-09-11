import { useState } from 'react';
import { motion } from 'framer-motion';
import { format, subMonths } from 'date-fns';
import {
  FileText,
  Download,
  Printer,
  Send,
  CheckCircle2,
  Shield,
  ChevronDown,
  Clock,
  FileCheck,
  Users,
  User,
  Eye,
  Check,
} from 'lucide-react';
import { mockUser, mockSupervisors } from '@/data/mockData';
import StatusBadge from './StatusBadge';

const formTypes = [
  {
    id: 'm-fvf-individual',
    code: 'M-FVF',
    name: 'Monthly Fieldwork Verification',
    subtitle: 'Individual Supervision',
    description: 'For candidates working with a single supervisor. One form per supervisor, per month.',
    icon: <User size={22} />,
  },
  {
    id: 'm-fvf-multiple',
    code: 'M-FVF',
    name: 'Monthly Fieldwork Verification',
    subtitle: 'Multiple Supervisors',
    description: 'For candidates working with more than one supervisor. Consolidated monthly form.',
    icon: <Users size={22} />,
  },
  {
    id: 'f-fvf-individual',
    code: 'F-FVF',
    name: 'Final Fieldwork Verification',
    subtitle: 'Individual Supervision',
    description: 'Final verification form for single-supervisor fieldwork. Completed at end of supervision.',
    icon: <FileCheck size={22} />,
  },
  {
    id: 'f-fvf-multiple',
    code: 'F-FVF',
    name: 'Final Fieldwork Verification',
    subtitle: 'Multiple Supervisors',
    description: 'Final verification form for multi-supervisor fieldwork. Completed at end of supervision.',
    icon: <Users size={22} />,
  },
];

const exportHistory = [
  {
    id: 'exp_001',
    formType: 'Monthly Fieldwork Verification',
    formCode: 'M-FVF',
    month: 'December 2024',
    exportedAt: '2025-01-03T10:00:00Z',
    status: 'COMPLETED' as const,
    supervisor: 'Dr. Emily Chen',
  },
  {
    id: 'exp_002',
    formType: 'Monthly Fieldwork Verification',
    formCode: 'M-FVF',
    month: 'November 2024',
    exportedAt: '2024-12-02T14:30:00Z',
    status: 'COMPLETED' as const,
    supervisor: 'Dr. Emily Chen',
  },
  {
    id: 'exp_003',
    formType: 'Monthly Fieldwork Verification',
    formCode: 'M-FVF',
    month: 'October 2024',
    exportedAt: '2024-11-01T09:15:00Z',
    status: 'COMPLETED' as const,
    supervisor: 'Dr. Marcus Johnson',
  },
  {
    id: 'exp_004',
    formType: 'Final Fieldwork Verification',
    formCode: 'F-FVF',
    month: 'Q4 2024',
    exportedAt: '2024-10-05T11:00:00Z',
    status: 'DRAFT' as const,
    supervisor: 'Dr. Emily Chen',
  },
];

const months = Array.from({ length: 6 }, (_, i) => subMonths(new Date(2025, 0, 1), i));

const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.06 } },
};

const itemVariants = {
  hidden: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.4 } },
};

export default function FormsExportTab() {
  const [selectedForm, setSelectedForm] = useState(formTypes[0].id);
  const [selectedMonth, setSelectedMonth] = useState(format(months[0], 'yyyy-MM'));
  const [showPreview, setShowPreview] = useState(false);
  const [showAttestation, setShowAttestation] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [exportSuccess, setExportSuccess] = useState(false);

  const selectedFormData = formTypes.find((f) => f.id === selectedForm)!;
  const primarySupervisor = mockSupervisors[0];

  const handleDownload = () => {
    setIsExporting(true);
    setTimeout(() => {
      setIsExporting(false);
      setExportSuccess(true);
      setTimeout(() => setExportSuccess(false), 3000);
    }, 1500);
  };

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="space-y-6"
    >
      {/* Official Banner */}
      <motion.div
        variants={itemVariants}
        className="flex items-center gap-3 bg-[#E8F5EE] rounded-2xl px-6 py-4 border border-[rgba(126,184,154,0.3)]"
      >
        <div className="p-2 rounded-xl bg-white">
          <Shield size={20} className="text-[#7EB89A]" />
        </div>
        <div>
          <p className="text-sm font-semibold text-[#5FA37E]">
            Official BACB Format Guaranteed
          </p>
          <p className="text-xs text-[#7EB89A]">
            Our exported forms match BACB templates exactly. All calculations verified and audit-ready.
          </p>
        </div>
      </motion.div>

      {/* Form Type Selection */}
      <motion.div variants={itemVariants}>
        <h3 className="font-serif text-lg font-semibold text-[#332C28] mb-4">
          Select Form Type
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {formTypes.map((form) => (
            <motion.button
              key={form.id}
              whileHover={{ y: -2 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => {
                setSelectedForm(form.id);
                setShowPreview(false);
              }}
              className={`relative p-5 rounded-2xl border-2 text-left transition-all duration-200 ${
                selectedForm === form.id
                  ? 'border-[#E85D70] bg-[#FFF5F7]'
                  : 'border-[#F2EDEA] bg-white hover:border-[#E2DAD5]'
              }`}
            >
              {selectedForm === form.id && (
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  className="absolute top-3 right-3 w-6 h-6 rounded-full bg-[#E85D70] flex items-center justify-center"
                >
                  <Check size={14} className="text-white" />
                </motion.div>
              )}
              <div
                className={`p-2.5 rounded-xl inline-flex mb-3 ${
                  selectedForm === form.id ? 'bg-[#FFE0E6] text-[#E85D70]' : 'bg-[#FAF8F6] text-[#A8998E]'
                }`}
              >
                {form.icon}
              </div>
              <div className="text-xs font-semibold text-[#E85D70] uppercase tracking-wider mb-1">
                {form.code}
              </div>
              <div className="font-medium text-[#332C28] text-sm mb-0.5">{form.name}</div>
              <div className="text-xs text-[#A8998E] mb-2">{form.subtitle}</div>
              <div className="text-xs text-[#C9BDB5] leading-relaxed">{form.description}</div>
            </motion.button>
          ))}
        </div>
      </motion.div>

      {/* Month Selector */}
      <motion.div
        variants={itemVariants}
        className="flex flex-col sm:flex-row items-start sm:items-center gap-4"
      >
        <div>
          <label className="block text-sm font-medium text-[#4D423C] mb-2">
            Select Period
          </label>
          <div className="relative">
            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="pl-4 pr-10 py-3 rounded-xl border border-[#E2DAD5] bg-white text-[#332C28] text-sm focus:border-[#F97B8A] focus:ring-4 focus:ring-[rgba(233,93,112,0.1)] transition-all outline-none appearance-none min-w-[220px]"
            >
              {months.map((m) => (
                <option key={format(m, 'yyyy-MM')} value={format(m, 'yyyy-MM')}>
                  {format(m, 'MMMM yyyy')}
                </option>
              ))}
            </select>
            <ChevronDown size={16} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[#C9BDB5] pointer-events-none" />
          </div>
        </div>
        <div className="flex items-center gap-3 mt-6">
          <button
            onClick={() => setShowPreview(!showPreview)}
            className="flex items-center gap-2 px-5 py-3 rounded-xl text-sm font-medium text-[#E85D70] bg-[#FFF5F7] hover:bg-[#FFE0E6] transition-colors"
          >
            <Eye size={16} />
            {showPreview ? 'Hide Preview' : 'Preview Form'}
          </button>
        </div>
      </motion.div>

      {/* Form Preview */}
      {showPreview && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          exit={{ opacity: 0, height: 0 }}
          className="bg-white rounded-2xl border-2 border-[#F2EDEA] shadow-[0_1px_4px_rgba(0,0,0,0.04)] overflow-hidden"
        >
          {/* Preview Header */}
          <div className="bg-[#FAF8F6] px-8 py-4 border-b border-[#F2EDEA] flex items-center justify-between">
            <div>
              <span className="text-xs font-semibold text-[#E85D70] uppercase tracking-wider">
                {selectedFormData.code}
              </span>
              <h4 className="font-medium text-[#332C28]">
                {selectedFormData.name} — {selectedFormData.subtitle}
              </h4>
            </div>
            <StatusBadge status="info">Preview</StatusBadge>
          </div>

          {/* Preview Body */}
          <div className="p-8 space-y-6">
            {/* Trainee & Supervisor Info */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div>
                <label className="block text-xs font-semibold text-[#A8998E] uppercase tracking-wider mb-2">
                  Trainee Name
                </label>
                <div className="px-4 py-3 rounded-xl bg-[#FAF8F6] border border-[#F2EDEA] text-sm text-[#332C28] font-medium">
                  {mockUser.displayName}
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#A8998E] uppercase tracking-wider mb-2">
                  Supervisor Name
                </label>
                <div className="px-4 py-3 rounded-xl bg-[#FAF8F6] border border-[#F2EDEA] text-sm text-[#332C28] font-medium">
                  {primarySupervisor.displayName}
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#A8998E] uppercase tracking-wider mb-2">
                  BACB Certification Number
                </label>
                <div className="px-4 py-3 rounded-xl bg-[#FAF8F6] border border-[#F2EDEA] text-sm text-[#332C28] font-medium">
                  {primarySupervisor.certificationNumber || '1-23-45678'}
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#A8998E] uppercase tracking-wider mb-2">
                  Date Range
                </label>
                <div className="px-4 py-3 rounded-xl bg-[#FAF8F6] border border-[#F2EDEA] text-sm text-[#332C28] font-medium">
                  {(() => {
                    const [year, month] = selectedMonth.split('-');
                    return `01/${month}/${year} — 31/${month}/${year}`;
                  })()}
                </div>
              </div>
            </div>

            {/* Hours Summary */}
            <div className="border border-[#F2EDEA] rounded-xl overflow-hidden">
              <div className="bg-[#FAF8F6] px-4 py-2.5 border-b border-[#F2EDEA]">
                <span className="text-xs font-semibold text-[#A8998E] uppercase tracking-wider">
                  Hours Summary
                </span>
              </div>
              <div className="grid grid-cols-3 divide-x divide-[#F2EDEA]">
                <div className="p-4 text-center">
                  <div className="font-mono text-2xl font-medium text-[#332C28]">87</div>
                  <div className="text-xs text-[#A8998E]">Total Hours</div>
                </div>
                <div className="p-4 text-center">
                  <div className="font-mono text-2xl font-medium text-[#7EB89A]">56</div>
                  <div className="text-xs text-[#A8998E]">Unrestricted</div>
                </div>
                <div className="p-4 text-center">
                  <div className="font-mono text-2xl font-medium text-[#E8A838]">31</div>
                  <div className="text-xs text-[#A8998E]">Restricted</div>
                </div>
              </div>
            </div>

            {/* Supervision Details */}
            <div className="border border-[#F2EDEA] rounded-xl overflow-hidden">
              <div className="bg-[#FAF8F6] px-4 py-2.5 border-b border-[#F2EDEA]">
                <span className="text-xs font-semibold text-[#A8998E] uppercase tracking-wider">
                  Supervision Details
                </span>
              </div>
              <div className="grid grid-cols-2 gap-4 p-4">
                <div>
                  <span className="text-xs text-[#A8998E]">Supervision Contacts</span>
                  <p className="text-sm font-medium text-[#332C28]">4 of 4 required</p>
                </div>
                <div>
                  <span className="text-xs text-[#A8998E]">Observations Conducted</span>
                  <p className="text-sm font-medium text-[#332C28]">2 of 1 required</p>
                </div>
              </div>
            </div>

            {/* Supervisor Attestation */}
            <div className="border border-[#F2EDEA] rounded-xl p-4">
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={showAttestation}
                  onChange={(e) => setShowAttestation(e.target.checked)}
                  className="mt-0.5 w-5 h-5 rounded border-[#E2DAD5] text-[#E85D70] focus:ring-[#E85D70]"
                />
                <div>
                  <p className="text-sm font-medium text-[#4D423C]">
                    Supervisor Attestation
                  </p>
                  <p className="text-xs text-[#A8998E] leading-relaxed mt-1">
                    I hereby certify that the above fieldwork hours were accrued under my supervision
                    and that the trainee has met all BACB requirements for this reporting period.
                    This attestation serves as my electronic signature.
                  </p>
                </div>
              </label>
            </div>

            <p className="text-xs text-[#C9BDB5] text-center">
              This is a preview. Download the PDF for the official BACB form with all required fields.
            </p>
          </div>
        </motion.div>
      )}

      {/* Export Actions */}
      <motion.div variants={itemVariants} className="flex flex-wrap gap-3">
        <motion.button
          whileHover={{ y: -2 }}
          whileTap={{ y: 0 }}
          onClick={handleDownload}
          disabled={isExporting}
          className="flex items-center gap-2 px-6 py-3.5 rounded-xl font-semibold text-sm text-white shadow-[0_4px_16px_rgba(233,93,112,0.3)] hover:shadow-[0_8px_24px_rgba(233,93,112,0.35)] transition-all disabled:opacity-70"
          style={{ background: 'linear-gradient(135deg, #E85D70 0%, #F97B8A 100%)' }}
        >
          {isExporting ? (
            <>
              <Clock size={16} className="animate-spin" />
              Generating PDF...
            </>
          ) : exportSuccess ? (
            <>
              <CheckCircle2 size={16} />
              Downloaded!
            </>
          ) : (
            <>
              <Download size={16} />
              Download PDF
            </>
          )}
        </motion.button>

        <button className="flex items-center gap-2 px-6 py-3.5 rounded-xl font-semibold text-sm border-2 border-[#E2DAD5] text-[#6B5D54] hover:border-[#C9BDB5] hover:bg-[#FAF8F6] transition-all">
          <Printer size={16} />
          Print
        </button>

        <button className="flex items-center gap-2 px-6 py-3.5 rounded-xl font-semibold text-sm border-2 border-[#E2DAD5] text-[#6B5D54] hover:border-[#C9BDB5] hover:bg-[#FAF8F6] transition-all">
          <Send size={16} />
          Send to Supervisor
        </button>
      </motion.div>

      {/* Export History */}
      <motion.div
        variants={itemVariants}
        className="bg-white rounded-2xl p-6 border border-[#F2EDEA] shadow-[0_1px_4px_rgba(0,0,0,0.04)]"
      >
        <h3 className="font-serif text-xl font-semibold text-[#332C28] mb-4">
          Export History
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-[#F2EDEA]">
                <th className="text-left text-xs font-semibold text-[#A8998E] uppercase tracking-wider pb-3 pr-4">
                  Form Type
                </th>
                <th className="text-left text-xs font-semibold text-[#A8998E] uppercase tracking-wider pb-3 pr-4">
                  Month
                </th>
                <th className="text-left text-xs font-semibold text-[#A8998E] uppercase tracking-wider pb-3 pr-4">
                  Exported
                </th>
                <th className="text-left text-xs font-semibold text-[#A8998E] uppercase tracking-wider pb-3 pr-4">
                  Supervisor
                </th>
                <th className="text-left text-xs font-semibold text-[#A8998E] uppercase tracking-wider pb-3">
                  Status
                </th>
              </tr>
            </thead>
            <tbody>
              {exportHistory.map((entry) => (
                <tr
                  key={entry.id}
                  className="border-b border-[#F2EDEA]/50 hover:bg-[#FFFCF9] transition-colors"
                >
                  <td className="py-3 pr-4">
                    <div className="flex items-center gap-2">
                      <FileText size={14} className="text-[#E85D70]" />
                      <span className="text-sm text-[#4D423C]">{entry.formType}</span>
                    </div>
                    <span className="text-xs text-[#C9BDB5] ml-6">{entry.formCode}</span>
                  </td>
                  <td className="py-3 pr-4 text-sm text-[#6B5D54]">{entry.month}</td>
                  <td className="py-3 pr-4 text-sm text-[#6B5D54]">
                    {format(new Date(entry.exportedAt), 'MMM d, yyyy')}
                  </td>
                  <td className="py-3 pr-4 text-sm text-[#6B5D54]">{entry.supervisor}</td>
                  <td className="py-3">
                    <StatusBadge
                      status={entry.status === 'COMPLETED' ? 'success' : 'info'}
                    >
                      {entry.status === 'COMPLETED' ? 'Completed' : 'Draft'}
                    </StatusBadge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </motion.div>
    </motion.div>
  );
}
