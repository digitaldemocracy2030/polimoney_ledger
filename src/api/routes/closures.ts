import { Hono } from 'hono';
import { getSupabaseClient } from '@/lib/supabase';
import { createUnlockRequest, checkUnlockStatus } from '@/lib/hub-client';

interface CheckResult {
  canClose: boolean;
  issues: Issue[];
  summary: {
    totalJournals: number;
    draftCount: number;
    missingReceiptCount: number;
    imbalanceCount: number;
  };
}

interface Issue {
  type: 'error' | 'warning';
  category: 'draft' | 'receipt' | 'imbalance';
  message: string;
  journalId?: string;
  journalDate?: string;
  description?: string;
}

interface ExecuteRequest {
  organizationId: string;
  year: number;
}

interface ArchiveRequest {
  organizationId: string;
  year: number;
}

interface ReopenRequest {
  organizationId: string;
  year: number;
}

interface UnlockRequestBody {
  organizationId: string;
  year: number;
  reason: string;
}

export const closuresRouter = new Hono();

closuresRouter.get('/check', async (c) => {
  const userId = c.get('userId');
  if (!userId) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  const organizationId = c.req.query('org_id');
  const yearParam = c.req.query('year');

  if (!organizationId || !yearParam) {
    return c.json({ error: 'org_id and year are required' }, 400);
  }

  const year = parseInt(yearParam, 10);
  if (isNaN(year)) {
    return c.json({ error: 'Invalid year' }, 400);
  }

  try {
    const supabase = getSupabaseClient(userId);

    const startDate = `${year}-01-01`;
    const endDate = `${year}-12-31`;

    const { data: journals, error: journalsError } = await supabase
      .from('journals')
      .select(
        `
        id,
        journal_date,
        description,
        status,
        journal_entries (
          id,
          debit_amount,
          credit_amount
        ),
        media_assets (
          id
        )
      `,
      )
      .eq('organization_id', organizationId)
      .gte('journal_date', startDate)
      .lte('journal_date', endDate);

    if (journalsError) {
      console.error('Failed to fetch journals:', journalsError);
      return c.json({ error: 'Failed to fetch journals' }, 500);
    }

    const issues: Issue[] = [];
    let draftCount = 0;
    let missingReceiptCount = 0;
    let imbalanceCount = 0;

    for (const journal of journals || []) {
      if (journal.status === 'draft') {
        draftCount++;
        issues.push({
          type: 'error',
          category: 'draft',
          message: `未承認の仕訳があります: ${journal.description}`,
          journalId: journal.id,
          journalDate: journal.journal_date,
          description: journal.description,
        });
      }

      const hasReceipt =
        journal.media_assets && journal.media_assets.length > 0;
      if (!hasReceipt) {
        missingReceiptCount++;
        issues.push({
          type: 'warning',
          category: 'receipt',
          message: `領収証が未添付です: ${journal.description}`,
          journalId: journal.id,
          journalDate: journal.journal_date,
          description: journal.description,
        });
      }

      const entries = journal.journal_entries || [];
      const totalDebit = entries.reduce(
        (sum: number, e: { debit_amount: number }) =>
          sum + (e.debit_amount || 0),
        0,
      );
      const totalCredit = entries.reduce(
        (sum: number, e: { credit_amount: number }) =>
          sum + (e.credit_amount || 0),
        0,
      );

      if (totalDebit !== totalCredit) {
        imbalanceCount++;
        issues.push({
          type: 'error',
          category: 'imbalance',
          message: `借方・貸方が不一致です: ${journal.description} (借方: ${totalDebit}, 貸方: ${totalCredit})`,
          journalId: journal.id,
          journalDate: journal.journal_date,
          description: journal.description,
        });
      }
    }

    const hasErrors = issues.some((issue) => issue.type === 'error');

    const result: CheckResult = {
      canClose: !hasErrors,
      issues,
      summary: {
        totalJournals: journals?.length || 0,
        draftCount,
        missingReceiptCount,
        imbalanceCount,
      },
    };

    return c.json(result);
  } catch (error) {
    console.error('Error checking closures:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

closuresRouter.post('/execute', async (c) => {
  const userId = c.get('userId');
  if (!userId) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  let body: ExecuteRequest;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: 'Invalid JSON body' }, 400);
  }

  const { organizationId, year } = body;

  if (!organizationId || !year) {
    return c.json({ error: 'organizationId and year are required' }, 400);
  }

  try {
    const supabase = getSupabaseClient(userId);

    const { data: org, error: orgError } = await supabase
      .from('political_organizations')
      .select('id, owner_user_id')
      .eq('id', organizationId)
      .single();

    if (orgError || !org) {
      return c.json({ error: 'Organization not found' }, 404);
    }

    const { data: existingClosure, error: closureError } = await supabase
      .from('ledger_year_closures')
      .select('*')
      .eq('organization_id', organizationId)
      .eq('fiscal_year', year)
      .maybeSingle();

    if (closureError) {
      console.error('Failed to check existing closure:', closureError);
      return c.json({ error: 'Failed to check existing closure' }, 500);
    }

    if (existingClosure && existingClosure.status !== 'open') {
      return c.json(
        { error: `Year ${year} is already ${existingClosure.status}` },
        400,
      );
    }

    const closureData = {
      organization_id: organizationId,
      fiscal_year: year,
      status: 'closed',
      closed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const { data: closure, error: upsertError } = await supabase
      .from('ledger_year_closures')
      .upsert(closureData, {
        onConflict: 'organization_id,fiscal_year',
      })
      .select()
      .single();

    if (upsertError) {
      console.error('Failed to close year:', upsertError);
      return c.json({ error: 'Failed to close year' }, 500);
    }

    return c.json({
      success: true,
      message: `${year}年度を締めました`,
      closure,
    });
  } catch (error) {
    console.error('Error executing closure:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

closuresRouter.post('/archive', async (c) => {
  const userId = c.get('userId');
  if (!userId) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  let body: ArchiveRequest;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: 'Invalid JSON body' }, 400);
  }

  const { organizationId, year } = body;

  if (!organizationId || !year) {
    return c.json({ error: 'organizationId and year are required' }, 400);
  }

  try {
    const supabase = getSupabaseClient(userId);

    const { data: org, error: orgError } = await supabase
      .from('political_organizations')
      .select('id, owner_user_id')
      .eq('id', organizationId)
      .single();

    if (orgError || !org) {
      return c.json({ error: 'Organization not found' }, 404);
    }

    const { data: existingClosure, error: closureError } = await supabase
      .from('ledger_year_closures')
      .select('*')
      .eq('organization_id', organizationId)
      .eq('fiscal_year', year)
      .maybeSingle();

    if (closureError) {
      console.error('Failed to check existing closure:', closureError);
      return c.json({ error: 'Failed to check existing closure' }, 500);
    }

    if (!existingClosure || existingClosure.status !== 'closed') {
      return c.json(
        {
          error: `Year ${year} must be in 'closed' status to archive. Current status: ${existingClosure?.status || 'not found'}`,
        },
        400,
      );
    }

    const { data: closure, error: updateError } = await supabase
      .from('ledger_year_closures')
      .update({
        status: 'locked',
        locked_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', existingClosure.id)
      .select()
      .single();

    if (updateError) {
      console.error('Failed to archive year:', updateError);
      return c.json({ error: 'Failed to archive year' }, 500);
    }

    return c.json({
      success: true,
      message: `${year}年度をアーカイブしました`,
      closure,
    });
  } catch (error) {
    console.error('Error executing archive:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

closuresRouter.post('/reopen', async (c) => {
  const userId = c.get('userId');
  if (!userId) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  let body: ReopenRequest;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: 'Invalid JSON body' }, 400);
  }

  const { organizationId, year } = body;

  if (!organizationId || !year) {
    return c.json({ error: 'organizationId and year are required' }, 400);
  }

  try {
    const supabase = getSupabaseClient(userId);

    const { data: org, error: orgError } = await supabase
      .from('political_organizations')
      .select('id, owner_user_id')
      .eq('id', organizationId)
      .single();

    if (orgError || !org) {
      return c.json({ error: 'Organization not found' }, 404);
    }

    const { data: existingClosure, error: closureError } = await supabase
      .from('ledger_year_closures')
      .select('*')
      .eq('organization_id', organizationId)
      .eq('fiscal_year', year)
      .maybeSingle();

    if (closureError) {
      console.error('Failed to check existing closure:', closureError);
      return c.json({ error: 'Failed to check existing closure' }, 500);
    }

    if (!existingClosure || existingClosure.status !== 'closed') {
      return c.json(
        {
          error: `Year ${year} must be in 'closed' status to reopen. Current status: ${existingClosure?.status || 'not found'}`,
        },
        400,
      );
    }

    const { error: deleteError } = await supabase
      .from('ledger_year_closures')
      .delete()
      .eq('id', existingClosure.id);

    if (deleteError) {
      console.error('Failed to reopen year:', deleteError);
      return c.json({ error: 'Failed to reopen year' }, 500);
    }

    return c.json({
      success: true,
      message: `${year}年度の締めを解除しました`,
    });
  } catch (error) {
    console.error('Error reopening year:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

closuresRouter.post('/unlock-request', async (c) => {
  const userId = c.get('userId');
  if (!userId) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  let body: UnlockRequestBody;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: 'Invalid JSON body' }, 400);
  }

  const { organizationId, year, reason } = body;

  if (!organizationId || !year) {
    return c.json({ error: 'organizationId and year are required' }, 400);
  }

  if (!reason || reason.trim().length < 10) {
    return c.json(
      { error: '理由は10文字以上で入力してください' },
      400,
    );
  }

  try {
    const supabase = getSupabaseClient(userId);

    const { data: org, error: orgError } = await supabase
      .from('political_organizations')
      .select('id, owner_user_id')
      .eq('id', organizationId)
      .single();

    if (orgError || !org) {
      return c.json({ error: 'Organization not found' }, 404);
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('email')
      .eq('id', userId)
      .single();

    const userEmail = profile?.email || 'unknown@example.com';

    const unlockRequest = await createUnlockRequest(
      {
        ledger_id: organizationId,
        ledger_type: 'organization',
        fiscal_year: year,
        requested_by_user_id: userId,
        requested_by_email: userEmail,
        reason: reason.trim(),
      },
      { userId },
    );

    return c.json({
      success: true,
      message: 'ロック解除リクエストを送信しました',
      request: unlockRequest,
    });
  } catch (error) {
    console.error('Error creating unlock request:', error);

    const errorMessage =
      error instanceof Error ? error.message : 'Internal server error';

    if (errorMessage.includes('pending unlock request already exists')) {
      return c.json(
        { error: '既にロック解除リクエストが申請中です' },
        409,
      );
    }

    return c.json({ error: errorMessage }, 500);
  }
});

closuresRouter.get('/unlock-request', async (c) => {
  const userId = c.get('userId');
  if (!userId) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  const organizationId = c.req.query('org_id');

  if (!organizationId) {
    return c.json({ error: 'org_id is required' }, 400);
  }

  try {
    const result = await checkUnlockStatus(organizationId, { userId });
    return c.json(result);
  } catch (error) {
    console.error('Error checking unlock status:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});
