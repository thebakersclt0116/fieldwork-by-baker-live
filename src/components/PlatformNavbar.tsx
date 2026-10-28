import { Link, NavLink, useLocation } from 'react-router';
import { withAcquisitionQuery } from '@/lib/acquisitionFunnel';
import { Archive, ChevronDown, CreditCard, LogOut, Moon, Settings, Sun, UserRound } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { MEMBER_NAV_ITEMS } from '@/lib/launchFeatures';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';

const PUBLIC_NAV_ITEMS = [
  { label: 'Pricing', path: '/pricing' },
  { label: 'Free demo', path: '/demo' },
] as const;

export default function PlatformNavbar({ isDark, onToggleDark }: { isDark: boolean; onToggleDark: () => void }) {
  const { user, isAuthenticated, isOwner, logout } = useAuth();
  const { search } = useLocation();
  const publicLink = (path: string) => withAcquisitionQuery(path, search);
  const initials = user?.initials || user?.name.split(/\s+/).filter(Boolean).map(part => part[0]).join('').slice(0, 2).toUpperCase() || 'ME';
  const accountItem = 'cursor-pointer rounded-lg px-3 py-2.5 text-sm focus:bg-[#FFF0F3] dark:focus:bg-white/10';
  const navigationItems = isAuthenticated ? MEMBER_NAV_ITEMS : PUBLIC_NAV_ITEMS;
  const navigation = navigationItems.map(({ label, path }) => <NavLink key={path} to={isAuthenticated ? path : publicLink(path)} className={({ isActive }) => `flex min-h-11 shrink-0 items-center justify-center rounded-xl px-3 py-2 text-center text-[13px] font-semibold transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#E85D70] ${isActive ? 'bg-[#FFF0F3] text-[#C53F55] dark:bg-[#E85D70]/15 dark:text-[#FF9DAE]' : 'text-[#6B5D54] hover:bg-[#F6F0EC] dark:text-[#D9CEC7] dark:hover:bg-white/5'}`}>{label}</NavLink>);
  return <header className="fixed inset-x-0 top-0 z-50 border-b border-[#EAE2DC] bg-[#FFFCF9]/95 backdrop-blur-xl dark:border-white/10 dark:bg-[#171412]/95">
    <div className="mx-auto flex h-[72px] max-w-[1500px] items-center justify-between gap-3 px-4 max-[380px]:gap-2 lg:h-20 lg:px-6">
      <Link to={isAuthenticated ? '/dashboard' : publicLink('/')} aria-label="Fieldwork by Baker home" className="flex shrink-0 items-baseline gap-1 max-[380px]:gap-0.5"><span className="font-serif text-[22px] font-bold text-[#332C28] max-[380px]:text-lg dark:text-[#F8F4F1]">Fieldwork</span><span className="text-sm font-semibold text-[#E85D70] max-[380px]:text-[11px]">by Baker</span></Link>
      <nav aria-label="Main navigation" className="hidden min-w-0 items-center gap-1 lg:flex">{navigation}</nav>
      {isAuthenticated ? <DropdownMenu>
        <DropdownMenuTrigger asChild><button type="button" aria-label="Open account menu" className="flex min-h-11 items-center gap-2 rounded-full p-1 pr-2 text-[#6B5D54] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#E85D70] dark:text-[#D9CEC7]"><span className="flex h-10 w-10 items-center justify-center rounded-full bg-[#332C28] text-sm font-bold text-[#F4C895] dark:bg-[#E7D4BF] dark:text-[#332C28]">{initials}</span><ChevronDown size={15} aria-hidden="true" /></button></DropdownMenuTrigger>
        <DropdownMenuContent align="end" sideOffset={12} className="z-[100] w-64 rounded-2xl border-[#EAE2DC] bg-white p-2 text-[#332C28] shadow-xl dark:border-white/10 dark:bg-[#211D1A] dark:text-[#F8F4F1]">
          <DropdownMenuLabel className="px-3 py-3"><span className="block text-sm font-semibold">{user?.name}</span><span className="mt-1 block truncate text-xs font-normal text-[#7B6B62] dark:text-[#CFC4BE]">{user?.email}</span></DropdownMenuLabel><DropdownMenuSeparator />
          <DropdownMenuItem asChild className={accountItem}><Link to="/settings#account"><UserRound size={16} />My Account</Link></DropdownMenuItem>
          <DropdownMenuItem asChild className={accountItem}><Link to="/settings"><Settings size={16} />My Settings</Link></DropdownMenuItem>
          <DropdownMenuItem asChild className={accountItem}><Link to="/settings#membership"><CreditCard size={16} />Membership</Link></DropdownMenuItem>
          <DropdownMenuItem onSelect={onToggleDark} className={accountItem}>{isDark ? <Sun size={16} /> : <Moon size={16} />}{isDark ? 'Use light appearance' : 'Use dark appearance'}</DropdownMenuItem>
          {isOwner && <><DropdownMenuSeparator /><DropdownMenuItem asChild className={accountItem}><Link to="/admin/archive"><Archive size={16} />Administrator archive</Link></DropdownMenuItem></>}
          <DropdownMenuSeparator /><DropdownMenuItem onSelect={logout} className={accountItem}><LogOut size={16} />Sign out</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu> : <div className="flex items-center gap-2 max-[380px]:gap-1"><Link to={publicLink('/login')} className="flex min-h-11 items-center whitespace-nowrap px-1 text-xs font-semibold text-[#6B5D54] dark:text-[#D9CEC7] max-[380px]:px-0 sm:px-2 sm:text-sm">Sign in</Link><Link to={publicLink('/signup')} className="whitespace-nowrap rounded-xl bg-[#E85D70] px-2.5 py-3 text-xs font-semibold text-white max-[380px]:px-2 max-[380px]:text-[11px] sm:px-3 sm:text-sm">Create account</Link></div>}
    </div>
    <nav aria-label="Mobile main navigation" className="grid h-[100px] grid-cols-2 items-center gap-1 px-3 pb-2 sm:flex sm:h-[52px] sm:overflow-x-auto lg:hidden">{navigation}</nav>
  </header>;
}
