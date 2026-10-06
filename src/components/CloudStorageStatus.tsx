import { useState } from 'react';
import { Link } from 'react-router';
import { AlertTriangle, CheckCircle2, ChevronDown, Cloud, Download, HardDrive, LoaderCircle, RefreshCw } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { downloadAuditArchive } from '../lib/migrationArchive';
import { downloadRawDeviceRecords, useCloudSync } from '../lib/cloudSync';

const labels = {
  local: 'Saved on this device', readonly: 'Viewing this device’s records', checking: 'Checking saved records', 'migration-required': 'Review device records',
  syncing: 'Saving to your account', synced: 'Cloud copy verified', waiting: 'Waiting to sync', conflict: 'Records need review', error: 'Cloud saving paused',
} as const;

export default function CloudStorageStatus() {
  const { user } = useAuth();
  const sync = useCloudSync();
  const [expanded, setExpanded] = useState(false);
  const [reviewed, setReviewed] = useState<string | null>(null);
  const [downloading, setDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState('');
  const busy = sync.phase === 'checking' || sync.phase === 'syncing';
  const reviewRequired = sync.phase === 'migration-required';
  const needsAttention = ['readonly', 'waiting', 'conflict', 'error'].includes(sync.phase);
  const details = expanded || reviewRequired || needsAttention;

  if (!user || sync.ownerEmail !== user.email) return null;

  const download = async () => {
    setDownloadError('');
    setDownloading(true);
    try {
      if (sync.rawRecoveryAvailable) await downloadRawDeviceRecords(user.email);
      else await downloadAuditArchive(user.email);
    }
    catch (error) { setDownloadError(error instanceof Error ? error.message : 'Your backup could not be downloaded. Please try again.'); }
    finally { setDownloading(false); }
  };

  return (
    <section aria-label="Your saved records" className="mx-auto max-w-[1500px] px-4 pt-3 lg:px-6">
      <div className={`rounded-2xl border ${needsAttention ? 'border-[#EAD4AC] bg-[#FFFBF4]' : 'border-[#E5E3DE] bg-white'} px-4 py-3 shadow-sm`}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2.5 min-w-0" role="status" aria-live="polite">
            {busy ? <LoaderCircle size={17} className="animate-spin text-[#7B6B62] shrink-0" /> : sync.phase === 'synced' ? <CheckCircle2 size={17} className="text-[#5FA37E] shrink-0" /> : needsAttention ? <AlertTriangle size={17} className="text-[#AE813F] shrink-0" /> : sync.phase === 'local' ? <HardDrive size={17} className="text-[#7B6B62] shrink-0" /> : <Cloud size={17} className="text-[#7B6B62] shrink-0" />}
            <span className="text-sm font-semibold text-[#4D423C]">{labels[sync.phase]}</span>
            {sync.phase === 'synced' && sync.lastVerifiedAt && <span className="hidden sm:inline text-xs text-[#A8998E]">{new Date(sync.lastVerifiedAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}</span>}
          </div>
          <button type="button" onClick={() => setExpanded((value) => !value)} aria-expanded={details} aria-controls="cloud-storage-details" className="inline-flex items-center gap-1 text-xs font-medium text-[#7B6B62] hover:text-[#E85D70]">
            {details && !reviewRequired && !needsAttention ? 'Hide details' : 'Storage details'} <ChevronDown size={14} className={details ? 'rotate-180' : ''} />
          </button>
        </div>

        {details && (
          <div id="cloud-storage-details" className="mt-3 border-t border-[#E8E2DB] pt-3">
            <p className="text-sm text-[#6B5D54] leading-relaxed">{sync.message}</p>
            {reviewRequired && (
              <div className="mt-4 max-w-2xl">
                <p className="text-xs text-[#7B6B62] mb-3">Connecting records to <strong className="break-all">{user.email}</strong>. Check the totals against your current workspace before continuing.</p>
                <div className="overflow-x-auto rounded-xl border border-[#E5E3DE]">
                  <table className="w-full text-left text-sm">
                    <caption className="sr-only">Records on this device and already in your cloud account</caption>
                    <thead className="bg-[#FAF7F3] text-[#7B6B62]"><tr><th className="px-3 py-2 font-medium">Saved records</th><th className="px-3 py-2 font-medium">This device</th><th className="px-3 py-2 font-medium">Your account</th></tr></thead>
                    <tbody className="text-[#4D423C]">
                      <tr className="border-t border-[#E5E3DE]"><th className="px-3 py-2 font-normal">Fieldwork entries</th><td className="px-3 py-2">{sync.localCounts?.entries ?? 0}</td><td className="px-3 py-2">{sync.cloudCounts?.entries ?? 0}</td></tr>
                      <tr className="border-t border-[#E5E3DE]"><th className="px-3 py-2 font-normal">Total hours</th><td className="px-3 py-2">{(sync.localCounts?.hours ?? 0).toFixed(2)}</td><td className="px-3 py-2">{(sync.cloudCounts?.hours ?? 0).toFixed(2)}</td></tr>
                      <tr className="border-t border-[#E5E3DE]"><th className="px-3 py-2 font-normal">Supervisors</th><td className="px-3 py-2">{sync.localCounts?.supervisors ?? 0}</td><td className="px-3 py-2">{sync.cloudCounts?.supervisors ?? 0}</td></tr>
                    </tbody>
                  </table>
                </div>
                <p className="mt-3 text-xs text-[#7B6B62]">This device also has {sync.archiveCounts?.documents ?? 0} original files and {sync.archiveCounts?.batches ?? 0} import history records. A recovery copy is preserved before any records are combined.</p>
                <label className="mt-4 flex items-start gap-2.5 text-sm text-[#4D423C]"><input type="checkbox" checked={Boolean(sync.reviewId && reviewed === sync.reviewId)} onChange={(event) => setReviewed(event.target.checked ? sync.reviewId : null)} className="mt-1" /><span>These are my records. I have checked the entries and hours above and closed any other Fieldwork tabs.</span></label>
                <button type="button" disabled={!sync.reviewId || reviewed !== sync.reviewId} onClick={() => { if (reviewed) void sync.connectThisDevice(reviewed); }} className="btn-primary mt-4 px-4 py-2.5 rounded-xl text-sm disabled:opacity-50"><Cloud size={16} /> Connect This Device</button>
              </div>
            )}
            {sync.phase === 'conflict' && <p className="mt-3 text-sm text-[#7B6B62]">{sync.conflictCount} record{sync.conflictCount === 1 ? '' : 's'} require review. <Link to="/dashboard" className="font-medium text-[#E85D70] underline">Open your workspace</Link> and download your complete backup to compare the saved copies.</p>}
            <div className="mt-4 flex flex-wrap items-center gap-4">
              {sync.phase !== 'local' && !reviewRequired && <button type="button" disabled={busy} onClick={() => { void sync.syncNow(); }} className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#7B6B62] hover:text-[#E85D70] disabled:opacity-50"><RefreshCw size={14} /> {busy ? 'Working…' : sync.phase === 'readonly' ? 'Check this tab' : 'Sync now'}</button>}
              <button type="button" disabled={downloading} onClick={() => { void download(); }} className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#7B6B62] hover:text-[#E85D70] disabled:opacity-50"><Download size={14} /> {downloading ? 'Preparing backup…' : sync.rawRecoveryAvailable ? 'Download device records for recovery' : 'Download complete backup'}</button>
            </div>
            {downloadError && <p className="mt-3 text-sm text-[#C9445A]" role="alert">{downloadError}</p>}
          </div>
        )}
      </div>
    </section>
  );
}
