import { Link } from 'react-router';
export default function Footer() {
  return <footer className="border-t border-[#EAE2DC] bg-[#FFFCF9] px-4 py-6 text-xs text-[#7B6B62] dark:border-white/10 dark:bg-[#171412] dark:text-[#CFC4BE]"><div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 sm:flex-row"><p>© {new Date().getFullYear()} Fieldwork by Baker. All rights reserved.</p><div className="flex flex-wrap justify-center gap-x-5 gap-y-3"><Link to="/privacy" className="hover:underline">Privacy</Link><Link to="/terms" className="hover:underline">Terms</Link><Link to="/security" className="hover:underline">Security</Link><Link to="/contact" className="hover:underline">Help & support</Link></div></div></footer>;
}
