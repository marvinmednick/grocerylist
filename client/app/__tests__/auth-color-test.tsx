import { pickProfileColor } from '../auth';
import { supabase } from '@/lib/supabase';

jest.mock('@/lib/supabase', () => ({
  supabase: {
    from: jest.fn(),
  },
}));

const mockFrom = supabase.from as jest.Mock;

describe('pickProfileColor', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns #2563eb when household has no profiles', async () => {
    const eq = jest.fn().mockResolvedValue({ data: [], error: null });
    const select = jest.fn().mockReturnValue({ eq });
    mockFrom.mockReturnValue({ select });

    const color = await pickProfileColor('household-1');

    expect(color).toBe('#2563eb');
  });

  it('returns first unused color when blue and green are already used', async () => {
    const eq = jest.fn().mockResolvedValue({
      data: [{ color: '#2563eb' }, { color: '#16a34a' }],
      error: null,
    });
    const select = jest.fn().mockReturnValue({ eq });
    mockFrom.mockReturnValue({ select });

    const color = await pickProfileColor('household-1');

    expect(color).toBe('#ea580c');
  });

  it('returns #2563eb when all seven palette colors are used', async () => {
    const eq = jest.fn().mockResolvedValue({
      data: [
        { color: '#2563eb' },
        { color: '#16a34a' },
        { color: '#ea580c' },
        { color: '#9333ea' },
        { color: '#dc2626' },
        { color: '#0d9488' },
        { color: '#db2777' },
      ],
      error: null,
    });
    const select = jest.fn().mockReturnValue({ eq });
    mockFrom.mockReturnValue({ select });

    const color = await pickProfileColor('household-1');

    expect(color).toBe('#2563eb');
  });
});
