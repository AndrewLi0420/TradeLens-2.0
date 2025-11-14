import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useRecommendationDetail } from '../hooks/useRecommendationDetail';
import RecommendationDetailContent from '../components/recommendations/RecommendationDetailContent';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';

/**
 * RecommendationDetail page component
 * Displays detailed information about a single recommendation
 * - Extracts recommendation ID from route params
 * - Checks authentication (redirects to login if not authenticated)
 * - Fetches recommendation data using React Query
 * - Displays loading and error states
 * - Provides back navigation to dashboard
 */
export default function RecommendationDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const { data: recommendation, isLoading, isError, error } = useRecommendationDetail(id || '');

  // Redirect to login if not authenticated
  if (!authLoading && !isAuthenticated) {
    navigate('/login', { replace: true });
    return null;
  }

  // Loading state
  if (authLoading || isLoading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-white">Loading recommendation...</div>
      </div>
    );
  }

  // Error state - 404 if recommendation not found, 403 if access denied
  if (isError) {
    const statusCode = error instanceof Error && 'response' in error 
      ? (error as any).response?.status 
      : null;
    
    if (statusCode === 404) {
      return (
        <div className="min-h-screen bg-black flex items-center justify-center">
          <div className="text-center">
            <h1 className="text-2xl font-bold text-white mb-4">Recommendation Not Found</h1>
            <p className="text-gray-400 mb-6">The recommendation you're looking for doesn't exist.</p>
            <Button onClick={() => navigate('/dashboard')} variant="outline">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Dashboard
            </Button>
          </div>
        </div>
      );
    }
    
    if (statusCode === 403) {
      return (
        <div className="min-h-screen bg-black flex items-center justify-center">
          <div className="text-center">
            <h1 className="text-2xl font-bold text-white mb-4">Access Denied</h1>
            <p className="text-gray-400 mb-6">You don't have access to this recommendation.</p>
            <Button onClick={() => navigate('/dashboard')} variant="outline">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Dashboard
            </Button>
          </div>
        </div>
      );
    }

    // Generic error
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-white mb-4">Error Loading Recommendation</h1>
          <p className="text-gray-400 mb-6">
            {error instanceof Error ? error.message : 'An unexpected error occurred'}
          </p>
          <Button onClick={() => navigate('/dashboard')} variant="outline">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Dashboard
          </Button>
        </div>
      </div>
    );
  }

  // No recommendation data
  if (!recommendation) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-white mb-4">No Recommendation Data</h1>
          <Button onClick={() => navigate('/dashboard')} variant="outline">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Dashboard
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="px-4 sm:px-0">
      {/* Back button */}
      <div className="mb-4 sm:mb-6">
        <Button
          onClick={() => navigate('/dashboard')}
          variant="ghost"
          className="text-gray-400 hover:text-white min-h-[44px] text-base"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Dashboard
        </Button>
      </div>

      {/* Recommendation detail content */}
      <RecommendationDetailContent recommendation={recommendation} />
    </div>
  );
}


