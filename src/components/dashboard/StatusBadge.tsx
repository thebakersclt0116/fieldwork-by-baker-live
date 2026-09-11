interface StatusBadgeProps {
  status: 'success' | 'warning' | 'error' | 'info' | 'premium' | 'pending';
  children: React.ReactNode;
}

const statusStyles = {
  success: 'bg-[#E8F5EE] text-[#7EB89A] border-[rgba(126,184,154,0.3)]',
  warning: 'bg-[#FFF3E0] text-[#E8A838] border-[rgba(232,168,56,0.3)]',
  error: 'bg-[#FDE8E9] text-[#D4626A] border-[rgba(212,98,106,0.3)]',
  info: 'bg-[#EBF4FA] text-[#6BA3D6] border-[rgba(107,163,214,0.3)]',
  premium: 'bg-[#FBF3EB] text-[#D4A574] border-[rgba(212,165,116,0.3)]',
  pending: 'bg-[#FFF5F7] text-[#E85D70] border-[rgba(233,93,112,0.3)]',
};

export default function StatusBadge({ status, children }: StatusBadgeProps) {
  return (
    <span
      className={`inline-flex items-center px-3.5 py-1 rounded-full text-xs font-semibold border ${statusStyles[status]}`}
    >
      {children}
    </span>
  );
}
