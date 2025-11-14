import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import Navigation from './Navigation';
import { Input } from '@/components/ui/input';
import { Search as SearchIcon, Menu } from 'lucide-react';
import {
  Sheet,
  SheetContent,
  SheetTrigger,
  SheetClose,
} from '@/components/ui/sheet';

interface HeaderProps {
  className?: string;
}

/**
 * Header component with app title/logo and navigation
 * Responsive: Desktop shows full nav, mobile shows hamburger menu
 */
export default function Header({ className = '' }: HeaderProps) {
  const { user, logout, isLoggingOut } = useAuth();
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const closeMobileMenu = () => {
    setMobileMenuOpen(false);
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim().length >= 2) {
      navigate(`/search?q=${encodeURIComponent(searchQuery.trim())}`);
      setSearchQuery('');
    }
  };

  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleSearchSubmit(e);
    }
  };

  return (
    <header className={`bg-black border-b border-gray-800 ${className}`}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          {/* Logo/Title */}
          <Link to="/dashboard" className="flex items-center">
            <h1 className="text-xl font-bold text-white">
              Trade<span className="text-financial-blue-light">Lens</span>
            </h1>
          </Link>

          {/* Desktop Navigation */}
          <div className="hidden md:flex md:items-center md:gap-4">
            {user && <Navigation />}
            {user && (
              <form onSubmit={handleSearchSubmit} className="flex items-center">
                <div className="relative">
                  <SearchIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                  <Input
                    type="text"
                    placeholder="Search stocks..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onKeyDown={handleSearchKeyDown}
                    className="pl-9 w-64 bg-gray-900 border-gray-800 text-white placeholder-gray-500 focus:border-financial-blue focus:ring-financial-blue text-base min-h-[44px]"
                    aria-label="Search stocks"
                  />
                </div>
              </form>
            )}
            {user && (
              <button
                onClick={() => logout()}
                disabled={isLoggingOut}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 disabled:bg-gray-700 disabled:cursor-not-allowed text-white rounded-lg transition-colors text-sm font-medium"
              >
                {isLoggingOut ? 'Logging out...' : 'Logout'}
              </button>
            )}
          </div>

          {/* Mobile Menu Button with Sheet */}
          {user && (
            <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
              <SheetTrigger asChild>
                <button
                  className="md:hidden p-2 text-gray-300 hover:text-white hover:bg-gray-800 rounded-lg transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center"
                  aria-label="Toggle menu"
                >
                  <Menu className="w-6 h-6" />
                </button>
              </SheetTrigger>
              <SheetContent side="left" className="w-80 bg-black border-gray-800">
                <div className="flex flex-col h-full">
                  <div className="mb-6">
                    <h2 className="text-xl font-bold text-white mb-4">Menu</h2>
                    <Navigation onLinkClick={closeMobileMenu} />
                  </div>
                  <div className="mt-auto space-y-4 pb-4">
                    <form onSubmit={handleSearchSubmit}>
                      <div className="relative">
                        <SearchIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                        <Input
                          type="text"
                          placeholder="Search stocks..."
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          onKeyDown={handleSearchKeyDown}
                          className="pl-9 w-full bg-gray-900 border-gray-800 text-white placeholder-gray-500 focus:border-financial-blue focus:ring-financial-blue text-base min-h-[44px]"
                          aria-label="Search stocks"
                        />
                      </div>
                    </form>
                    <button
                      onClick={() => {
                        closeMobileMenu();
                        logout();
                      }}
                      disabled={isLoggingOut}
                      className="w-full px-4 py-3 bg-red-600 hover:bg-red-700 disabled:bg-gray-700 disabled:cursor-not-allowed text-white rounded-lg transition-colors font-medium min-h-[44px]"
                    >
                      {isLoggingOut ? 'Logging out...' : 'Logout'}
                    </button>
                  </div>
                </div>
              </SheetContent>
            </Sheet>
          )}
        </div>
      </div>
    </header>
  );
}

