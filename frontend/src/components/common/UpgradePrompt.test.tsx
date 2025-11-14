import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BrowserRouter } from 'react-router-dom';
import UpgradePrompt from './UpgradePrompt';
import { DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

describe('UpgradePrompt', () => {
  it('renders upgrade prompt dialog when opened', async () => {
    const user = userEvent.setup();
    render(
      <BrowserRouter>
        <UpgradePrompt
          stockLimit={5}
          trigger={
            <DialogTrigger asChild>
              <Button>Open Upgrade</Button>
            </DialogTrigger>
          }
        />
      </BrowserRouter>
    );

    const triggerButton = screen.getByRole('button', { name: /Open Upgrade/i });
    await user.click(triggerButton);

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /Upgrade to Premium/i })).toBeInTheDocument();
      expect(screen.getByText(/You've reached your free tier limit \(5 stocks\)/i)).toBeInTheDocument();
    });
  });

  it('displays premium features list', async () => {
    const user = userEvent.setup();
    render(
      <BrowserRouter>
        <UpgradePrompt
          stockLimit={5}
          open={true}
        />
      </BrowserRouter>
    );

    await waitFor(() => {
      expect(screen.getByText(/Premium Features:/i)).toBeInTheDocument();
      expect(screen.getByText(/Unlimited stock tracking/i)).toBeInTheDocument();
      expect(screen.getByText(/Advanced analytics and insights/i)).toBeInTheDocument();
    });
  });

  it('renders upgrade button with correct link', async () => {
    render(
      <BrowserRouter>
        <UpgradePrompt
          stockLimit={5}
          open={true}
        />
      </BrowserRouter>
    );

    await waitFor(() => {
      const upgradeLink = screen.getByRole('link', { name: /Upgrade to Premium/i });
      expect(upgradeLink).toBeInTheDocument();
      expect(upgradeLink).toHaveAttribute('href', '/upgrade');
    });
  });

  it('displays correct stock limit in message', async () => {
    render(
      <BrowserRouter>
        <UpgradePrompt
          stockLimit={3}
          open={true}
        />
      </BrowserRouter>
    );

    await waitFor(() => {
      expect(screen.getByText(/3 stocks/i)).toBeInTheDocument();
    });
  });

  it('can be closed with "Maybe Later" button', async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();
    
    render(
      <BrowserRouter>
        <UpgradePrompt
          stockLimit={5}
          open={true}
          onOpenChange={onOpenChange}
        />
      </BrowserRouter>
    );

    await waitFor(() => {
      const maybeLaterButton = screen.getByRole('button', { name: /Maybe Later/i });
      expect(maybeLaterButton).toBeInTheDocument();
    });

    const maybeLaterButton = screen.getByRole('button', { name: /Maybe Later/i });
    await user.click(maybeLaterButton);

    await waitFor(() => {
      expect(onOpenChange).toHaveBeenCalledWith(false);
    });
  });

  it('works as controlled component', async () => {
    const { rerender } = render(
      <BrowserRouter>
        <UpgradePrompt
          stockLimit={5}
          open={false}
        />
      </BrowserRouter>
    );

    expect(screen.queryByRole('heading', { name: /Upgrade to Premium/i })).not.toBeInTheDocument();

    rerender(
      <BrowserRouter>
        <UpgradePrompt
          stockLimit={5}
          open={true}
        />
      </BrowserRouter>
    );

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /Upgrade to Premium/i })).toBeInTheDocument();
    });
  });
});

