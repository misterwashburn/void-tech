const SUPABASE_URL = 'https://prrtdkjapjqmddnhwgit.supabase.co';
const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_q4Gzfh5m5SXd2279_aj6mA_jXeeIifq';

const client = window.supabase.createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);

const authPanel = document.querySelector('#authPanel');
const dashboard = document.querySelector('#dashboard');
const authError = document.querySelector('#authError');
const signedInAs = document.querySelector('#signedInAs');
const adminWarning = document.querySelector('#adminWarning');

function formatDate(value) {
  if (!value) return 'Never';
  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(value));
}

function formatCurrency(cents, currency = 'USD') {
  return new Intl.NumberFormat(undefined, { currency, style: 'currency' }).format((cents || 0) / 100);
}

function isAdmin(user) {
  return user?.app_metadata?.role === 'admin' || user?.app_metadata?.is_admin === true || user?.app_metadata?.is_admin === 'true';
}

function renderMetrics(overview) {
  const metrics = [
    ['Users', overview?.total_users ?? 0],
    ['New 7d', overview?.new_users_7d ?? 0],
    ['Events 24h', overview?.events_24h ?? 0],
    ['Open Bugs', overview?.open_bug_reports ?? 0],
    ['Revenue', formatCurrency(overview?.recorded_revenue_cents ?? 0)],
  ];

  document.querySelector('#metrics').innerHTML = metrics
    .map(([label, value]) => `<div class="metric"><strong>${value}</strong><span>${label}</span></div>`)
    .join('');
}

function renderTable(selector, headers, rows, emptyMessage) {
  const table = document.querySelector(selector);
  if (!rows.length) {
    table.innerHTML = `<tbody><tr><td class="muted">${emptyMessage}</td></tr></tbody>`;
    return;
  }

  table.innerHTML = `
    <thead><tr>${headers.map((header) => `<th>${header}</th>`).join('')}</tr></thead>
    <tbody>${rows.join('')}</tbody>
  `;
}

async function loadDashboard() {
  const { data: sessionData } = await client.auth.getSession();
  const user = sessionData.session?.user;

  if (!user) {
    authPanel.hidden = false;
    dashboard.hidden = true;
    return;
  }

  authPanel.hidden = true;
  dashboard.hidden = false;
  signedInAs.textContent = user.email || user.id;
  adminWarning.style.display = isAdmin(user) ? 'none' : 'block';

  const [overviewResult, profilesResult, eventsResult, bugsResult, financialsResult] = await Promise.all([
    client.from('admin_overview').select('*').maybeSingle(),
    client.from('profiles').select('id,email,display_name,plan,onboarding_state,last_seen_at,created_at').order('created_at', { ascending: false }).limit(50),
    client.from('app_events').select('id,user_id,event_name,event_type,route,occurred_at').order('occurred_at', { ascending: false }).limit(80),
    client.from('bug_reports').select('id,reporter_email,title,severity,status,created_at').order('created_at', { ascending: false }).limit(50),
    client.from('financial_events').select('id,provider,event_type,amount_cents,currency,status,occurred_at').order('occurred_at', { ascending: false }).limit(50),
  ]);

  const firstError = overviewResult.error || profilesResult.error || eventsResult.error || bugsResult.error || financialsResult.error;
  if (firstError) {
    authError.textContent = firstError.message;
  }

  renderMetrics(overviewResult.data);
  renderTable(
    '#usersTable',
    ['User', 'Plan', 'State', 'Last Seen'],
    (profilesResult.data || []).map((row) => `
      <tr><td>${row.email || row.display_name || row.id}</td><td>${row.plan}</td><td>${row.onboarding_state}</td><td>${formatDate(row.last_seen_at || row.created_at)}</td></tr>
    `),
    'No users have signed up yet.'
  );
  renderTable(
    '#eventsTable',
    ['Event', 'Type', 'Route', 'When'],
    (eventsResult.data || []).map((row) => `
      <tr><td>${row.event_name}</td><td>${row.event_type}</td><td>${row.route || ''}</td><td>${formatDate(row.occurred_at)}</td></tr>
    `),
    'No behavior events have been recorded.'
  );
  renderTable(
    '#bugsTable',
    ['Title', 'Severity', 'Status', 'When'],
    (bugsResult.data || []).map((row) => `
      <tr><td>${row.title}</td><td>${row.severity}</td><td>${row.status}</td><td>${formatDate(row.created_at)}</td></tr>
    `),
    'No bug reports are open.'
  );
  renderTable(
    '#financialsTable',
    ['Type', 'Provider', 'Status', 'Amount'],
    (financialsResult.data || []).map((row) => `
      <tr><td>${row.event_type}</td><td>${row.provider}</td><td>${row.status}</td><td>${formatCurrency(row.amount_cents, row.currency)}</td></tr>
    `),
    'No financial events have been recorded.'
  );
}

document.querySelector('#signInButton').addEventListener('click', async () => {
  authError.textContent = '';
  const email = document.querySelector('#email').value.trim();
  const password = document.querySelector('#password').value;
  const { error } = await client.auth.signInWithPassword({ email, password });
  if (error) {
    authError.textContent = error.message;
    return;
  }
  await loadDashboard();
});

document.querySelector('#appleSignInButton').addEventListener('click', async () => {
  authError.textContent = '';
  const { error } = await client.auth.signInWithOAuth({
    provider: 'apple',
    options: {
      redirectTo: `${window.location.origin}${window.location.pathname}`,
    },
  });

  if (error) {
    authError.textContent = error.message;
  }
});

document.querySelector('#signOutButton').addEventListener('click', async () => {
  await client.auth.signOut();
  await loadDashboard();
});

document.querySelector('#refreshButton').addEventListener('click', loadDashboard);

document.querySelector('#recordFinanceButton').addEventListener('click', async () => {
  const eventType = document.querySelector('#financeType').value.trim() || 'manual_entry';
  const amount = Number(document.querySelector('#financeAmount').value);
  if (!Number.isFinite(amount)) return;

  const { error } = await client.from('financial_events').insert({
    amount_cents: Math.round(amount * 100),
    currency: 'USD',
    event_type: eventType,
    provider: 'manual',
    status: 'recorded',
  });

  if (error) {
    authError.textContent = error.message;
    return;
  }

  document.querySelector('#financeAmount').value = '';
  await loadDashboard();
});

client.auth.onAuthStateChange(loadDashboard);
loadDashboard();
