import { Link, useLocation } from 'react-router-dom';

interface NavigationProps {
  className?: string;
  onLinkClick?: () => void; // For mobile menu close
}

/**
 * Navigation component with Dashboard, Historical, and Profile links
 * Includes active route highlighting and responsive design
 */
export default function Navigation({ className = '', onLinkClick }: NavigationProps) {
  const location = useLocation();

  const navLinks = [
    { path: '/dashboard', label: 'Dashboard' },
    { path: '/historical', label: 'Historical' },
    { path: '/profile', label: 'Profile' },
  ];

  const isActive = (path: string) => location.pathname === path;

  const handleLinkClick = () => {
    if (onLinkClick) {
      onLinkClick();
    }
  };

  return (
    <nav className={className}>
      <ul className="flex flex-col md:flex-row gap-4 md:gap-6">
        {navLinks.map((link) => (
          <li key={link.path}>
            <Link
              to={link.path}
              onClick={handleLinkClick}
              className={`
                block px-4 py-3 rounded-lg transition-colors font-medium text-base min-h-[44px] flex items-center
                ${
                  isActive(link.path)
                    ? 'bg-blue-600 text-white'
                    : 'text-gray-300 hover:text-white hover:bg-gray-800'
                }
              `}
            >
              {link.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}

