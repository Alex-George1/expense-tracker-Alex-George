const storageKeys = {
  transactions: 'expenseTracker.transactions',
  logs: 'expenseTracker.logs',
};

const categorySuggestions = [
  'Salary',
  'Freelance',
  'Food',
  'Groceries',
  'Transport',
  'Bills',
  'Health',
  'Education',
  'Entertainment',
  'Shopping',
  'Rent',
  'Savings',
  'Other',
];

const state = {
  transactions: loadJson(storageKeys.transactions, []),
  logs: loadJson(storageKeys.logs, []),
  currentMonth: startOfMonth(new Date()),
  selectedDate: formatDate(new Date()),
  editingTransactionId: null,
  chartInstance: null,
  filters: {
    search: '',
    type: 'all',
    category: 'all',
  },
};

const elements = {};

document.addEventListener('DOMContentLoaded', () => {
  bindElements();
  initDateState();
  bindEvents();
  syncCategoryOptions();
  refreshAll();
});

function bindElements() {
  const ids = [
    'calendarTitle',
    'calendarGrid',
    'monthSummary',
    'monthOverviewTitle',
    'monthTrends',
    'totalIncome',
    'totalExpenses',
    'totalBalance',
    'logList',
    'logSearch',
    'typeFilter',
    'categoryFilter',
    'dayModalLabel',
    'dayStats',
    'transactionForm',
    'transactionId',
    'transactionType',
    'transactionAmount',
    'transactionCategory',
    'transactionDate',
    'transactionDescription',
    'transactionModal',
    'formTitle',
    'cancelEdit',
    'resetForm',
    'saveTransaction',
    'dayTransactionList',
    'dayTransactionCount',
    'formAlert',
    'openChart',
    'chartModal',
    'expenseChart',
    'prevMonth',
    'todayMonth',
    'nextMonth',
    'categorySuggestions',
  ];

  ids.forEach((id) => {
    elements[id] = document.getElementById(id);
  });

  elements.dayModal = document.getElementById('dayModal');
  elements.chartModalElement = document.getElementById('chartModal');
  elements.dayModalInstance = bootstrap.Modal.getOrCreateInstance(elements.dayModal);
  elements.chartModalInstance = bootstrap.Modal.getOrCreateInstance(elements.chartModalElement);
}

function initDateState() {
  elements.transactionDate.value = state.selectedDate;
  elements.transactionDate.min = '2000-01-01';
  elements.transactionDate.max = '2099-12-31';
}

function bindEvents() {
  elements.prevMonth.addEventListener('click', () => {
    state.currentMonth = shiftMonth(state.currentMonth, -1);
    refreshCalendar();
  });

  elements.todayMonth.addEventListener('click', () => {
    state.currentMonth = startOfMonth(new Date());
    refreshCalendar();
  });

  elements.nextMonth.addEventListener('click', () => {
    state.currentMonth = shiftMonth(state.currentMonth, 1);
    refreshCalendar();
  });

  elements.logSearch.addEventListener('input', (event) => {
    state.filters.search = event.target.value.trim().toLowerCase();
    refreshLogs();
  });

  elements.typeFilter.addEventListener('change', (event) => {
    state.filters.type = event.target.value;
    refreshLogs();
  });

  elements.categoryFilter.addEventListener('change', (event) => {
    state.filters.category = event.target.value;
    refreshLogs();
  });

  elements.transactionForm.addEventListener('submit', handleSubmit);
  elements.resetForm.addEventListener('click', clearForm);
  elements.cancelEdit.addEventListener('click', clearEditingState);
  elements.openChart.addEventListener('click', openChartModal);
  elements.dayModal.addEventListener('hidden.bs.modal', clearForm);
  elements.chartModalElement.addEventListener('shown.bs.modal', renderChart);
}

function refreshAll() {
  syncCategoryOptions();
  refreshDashboard();
  refreshCalendar();
  refreshMonthSummary();
  refreshLogs();
  if (state.chartInstance) {
    renderChart();
  }
}

function refreshDashboard() {
  const income = sumByType(state.transactions, 'income');
  const expenses = sumByType(state.transactions, 'expense');
  const balance = income - expenses;

  elements.totalIncome.textContent = formatCurrency(income);
  elements.totalExpenses.textContent = formatCurrency(expenses);
  elements.totalBalance.textContent = formatCurrency(balance);
}

function refreshCalendar() {
  const monthDate = new Date(state.currentMonth);
  const year = monthDate.getFullYear();
  const month = monthDate.getMonth();
  const firstDay = new Date(year, month, 1);
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const startingOffset = firstDay.getDay();
  const today = formatDate(new Date());

  elements.calendarTitle.textContent = firstDay.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
  elements.monthOverviewTitle.textContent = firstDay.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
  elements.monthTrends.innerHTML = '';
  elements.calendarGrid.innerHTML = '';

  for (let i = 0; i < startingOffset; i += 1) {
    const emptyCell = document.createElement('button');
    emptyCell.type = 'button';
    emptyCell.className = 'calendar-day is-empty';
    emptyCell.setAttribute('aria-hidden', 'true');
    elements.calendarGrid.appendChild(emptyCell);
  }

  for (let day = 1; day <= daysInMonth; day += 1) {
    const dateValue = formatDate(new Date(year, month, day));
    const dailyTotals = getDailyTotals(dateValue);
    const net = dailyTotals.income - dailyTotals.expense;
    const cell = document.createElement('button');
    cell.type = 'button';
    cell.className = 'calendar-day';
    if (dateValue === today) {
      cell.classList.add('is-today');
    }
    if (dateValue === state.selectedDate) {
      cell.classList.add('is-selected');
    }
    cell.setAttribute('aria-label', `${formatReadableDate(dateValue)}. Balance ${formatCurrency(net)}.`);
    cell.innerHTML = `
      <div class="day-number">
        <span>${day}</span>
        <span class="badge ${getBadgeClass(net)}">${dailyTotals.count}</span>
      </div>
      <div class="day-total ${getBalanceClass(net)}">${formatSignedCurrency(net)}</div>
      <div class="day-subtext">${dailyTotals.count} transaction${dailyTotals.count === 1 ? '' : 's'}</div>
    `;
    cell.addEventListener('click', () => openDayModal(dateValue));
    elements.calendarGrid.appendChild(cell);
  }

  const monthTransactions = getTransactionsForMonth(year, month);
  const monthIncome = sumByType(monthTransactions, 'income');
  const monthExpenses = sumByType(monthTransactions, 'expense');
  const monthBalance = monthIncome - monthExpenses;

  elements.monthTrends.innerHTML = [
    createTrendCard('Income', monthIncome, 'metric-income'),
    createTrendCard('Expenses', monthExpenses, 'metric-expense'),
    createTrendCard('Balance', monthBalance, 'metric-balance'),
  ].join('');
}

function refreshMonthSummary() {
  const monthTransactions = getTransactionsForMonth(state.currentMonth.getFullYear(), state.currentMonth.getMonth());
  const income = sumByType(monthTransactions, 'income');
  const expenses = sumByType(monthTransactions, 'expense');
  const balance = income - expenses;

  elements.monthSummary.innerHTML = `
    <div class="col-md-4">
      <div class="metric-card metric-income">
        <span>Month income</span>
        <strong>${formatCurrency(income)}</strong>
      </div>
    </div>
    <div class="col-md-4">
      <div class="metric-card metric-expense">
        <span>Month expenses</span>
        <strong>${formatCurrency(expenses)}</strong>
      </div>
    </div>
    <div class="col-md-4">
      <div class="metric-card metric-balance">
        <span>Month balance</span>
        <strong>${formatCurrency(balance)}</strong>
      </div>
    </div>
  `;
}

function refreshLogs() {
  const filtered = getFilteredTransactions();

  if (filtered.length === 0) {
    elements.logList.innerHTML = `
      <div class="empty-state">
        No matching transactions yet. Add one from the calendar to start tracking.
      </div>
    `;
    return;
  }

  elements.logList.innerHTML = filtered
    .slice()
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    .map((transaction) => {
      const log = getLatestLogForTransaction(transaction.id) || createSyntheticLog(transaction);
      return `
        <article class="log-item">
          <div class="d-flex justify-content-between align-items-start gap-2 mb-2">
            <div>
              <div class="d-flex flex-wrap align-items-center gap-2 mb-1">
                <span class="badge ${transaction.type === 'income' ? 'badge-soft-income' : 'badge-soft-expense'}">${capitalize(transaction.type)}</span>
                <strong>${escapeHtml(transaction.category)}</strong>
              </div>
              <div class="meta">${escapeHtml(transaction.description)}</div>
            </div>
            <strong class="${transaction.type === 'income' ? 'text-success-emphasis' : 'text-danger-emphasis'}">${transaction.type === 'income' ? '+' : '-'}${formatCurrency(transaction.amount)}</strong>
          </div>
          <div class="d-flex flex-wrap justify-content-between gap-2 meta">
            <span>${formatReadableDate(transaction.date)}</span>
            <span>${escapeHtml(log.actionLabel)} · ${new Date(log.timestamp).toLocaleString()}</span>
          </div>
        </article>
      `;
    })
    .join('');
}

function openDayModal(dateValue) {
  state.selectedDate = dateValue;
  elements.transactionDate.value = dateValue;
  elements.dayModalLabel.textContent = formatReadableDate(dateValue);
  refreshDayModal(dateValue);
  elements.dayModalInstance.show();
}

function refreshDayModal(dateValue) {
  const dailyTransactions = getTransactionsByDate(dateValue);
  const totals = getDailyTotals(dateValue);
  const net = totals.income - totals.expense;

  elements.dayStats.innerHTML = [
    createStatCard('Income', totals.income, 'metric-income'),
    createStatCard('Expenses', totals.expense, 'metric-expense'),
    createStatCard('Balance', net, 'metric-balance'),
  ].join('');

  elements.dayTransactionCount.textContent = `${dailyTransactions.length} item${dailyTransactions.length === 1 ? '' : 's'}`;

  if (dailyTransactions.length === 0) {
    elements.dayTransactionList.innerHTML = `
      <div class="empty-state mb-0">
        No transactions for this day yet.
      </div>
    `;
    return;
  }

  elements.dayTransactionList.innerHTML = dailyTransactions
    .slice()
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    .map((transaction) => `
      <article class="transaction-item">
        <div class="d-flex justify-content-between align-items-start gap-3 mb-2">
          <div>
            <div class="d-flex align-items-center gap-2 mb-1">
              <span class="badge ${transaction.type === 'income' ? 'badge-soft-income' : 'badge-soft-expense'}">${capitalize(transaction.type)}</span>
              <strong>${escapeHtml(transaction.category)}</strong>
            </div>
            <div class="meta">${escapeHtml(transaction.description)}</div>
          </div>
          <strong class="${transaction.type === 'income' ? 'text-success-emphasis' : 'text-danger-emphasis'}">${transaction.type === 'income' ? '+' : '-'}${formatCurrency(transaction.amount)}</strong>
        </div>
        <div class="d-flex justify-content-between align-items-center gap-2 flex-wrap">
          <div class="meta">${new Date(transaction.updatedAt).toLocaleString()}</div>
          <div class="d-flex gap-2">
            <button class="btn btn-sm btn-outline-light" type="button" data-action="edit" data-id="${transaction.id}">Edit</button>
            <button class="btn btn-sm btn-outline-danger" type="button" data-action="delete" data-id="${transaction.id}">Delete</button>
          </div>
        </div>
      </article>
    `)
    .join('');

  elements.dayTransactionList.querySelectorAll('button[data-action]').forEach((button) => {
    button.addEventListener('click', handleTransactionAction);
  });
}

function handleTransactionAction(event) {
  const action = event.currentTarget.getAttribute('data-action');
  const transactionId = event.currentTarget.getAttribute('data-id');

  if (action === 'edit') {
    const transaction = state.transactions.find((item) => item.id === transactionId);
    if (!transaction) {
      return;
    }
    populateForm(transaction);
    return;
  }

  if (action === 'delete') {
    deleteTransaction(transactionId);
  }
}

function populateForm(transaction) {
  state.editingTransactionId = transaction.id;
  elements.transactionId.value = transaction.id;
  elements.transactionType.value = transaction.type;
  elements.transactionAmount.value = transaction.amount;
  elements.transactionCategory.value = transaction.category;
  elements.transactionDate.value = transaction.date;
  elements.transactionDescription.value = transaction.description;
  elements.formTitle.textContent = 'Edit transaction';
  elements.saveTransaction.textContent = 'Update transaction';
  elements.cancelEdit.classList.remove('d-none');
  elements.formAlert.classList.add('d-none');
}

function clearEditingState() {
  state.editingTransactionId = null;
  elements.transactionId.value = '';
  elements.transactionForm.reset();
  elements.transactionType.value = 'income';
  elements.transactionDate.value = state.selectedDate;
  elements.formTitle.textContent = 'Add transaction';
  elements.saveTransaction.textContent = 'Save transaction';
  elements.cancelEdit.classList.add('d-none');
  elements.formAlert.classList.add('d-none');
  clearValidation();
}

function clearForm() {
  clearEditingState();
}

function handleSubmit(event) {
  event.preventDefault();
  clearValidation();

  const payload = readFormData();
  const validationError = validateTransaction(payload);

  if (validationError) {
    showFormError(validationError);
    return;
  }

  if (state.editingTransactionId) {
    updateTransaction(state.editingTransactionId, payload);
  } else {
    createTransaction(payload);
  }

  clearEditingState();
  state.selectedDate = payload.date;
  refreshAll();
  refreshDayModal(payload.date);
  elements.transactionDate.value = payload.date;
}

function readFormData() {
  return {
    type: elements.transactionType.value,
    amount: Number.parseFloat(elements.transactionAmount.value),
    category: elements.transactionCategory.value.trim(),
    date: elements.transactionDate.value,
    description: elements.transactionDescription.value.trim(),
  };
}

function validateTransaction(payload) {
  if (!payload.date) {
    return 'Please choose a date.';
  }
  if (!payload.category) {
    return 'Category is required.';
  }
  if (!payload.description) {
    return 'Description is required.';
  }
  if (!Number.isFinite(payload.amount) || payload.amount <= 0) {
    return 'Enter a valid amount greater than zero.';
  }
  return '';
}

function createTransaction(payload) {
  const now = new Date().toISOString();
  const transaction = {
    id: crypto.randomUUID(),
    ...payload,
    createdAt: now,
    updatedAt: now,
  };
  state.transactions.unshift(transaction);
  logAction('added', transaction);
  persistState();
}

function updateTransaction(transactionId, payload) {
  const transaction = state.transactions.find((item) => item.id === transactionId);
  if (!transaction) {
    return;
  }
  transaction.type = payload.type;
  transaction.amount = payload.amount;
  transaction.category = payload.category;
  transaction.date = payload.date;
  transaction.description = payload.description;
  transaction.updatedAt = new Date().toISOString();
  logAction('updated', transaction);
  persistState();
}

function deleteTransaction(transactionId) {
  const transaction = state.transactions.find((item) => item.id === transactionId);
  if (!transaction) {
    return;
  }

  const confirmed = window.confirm(`Delete ${transaction.category} on ${formatReadableDate(transaction.date)}?`);
  if (!confirmed) {
    return;
  }

  state.transactions = state.transactions.filter((item) => item.id !== transactionId);
  logAction('deleted', transaction);
  persistState();

  if (state.editingTransactionId === transactionId) {
    clearEditingState();
  }

  refreshAll();
  refreshDayModal(state.selectedDate);
}

function logAction(action, transaction) {
  state.logs.unshift({
    id: crypto.randomUUID(),
    action,
    actionLabel: action.charAt(0).toUpperCase() + action.slice(1),
    transactionId: transaction.id,
    type: transaction.type,
    category: transaction.category,
    amount: transaction.amount,
    description: transaction.description,
    date: transaction.date,
    timestamp: new Date().toISOString(),
  });
}

function persistState() {
  localStorage.setItem(storageKeys.transactions, JSON.stringify(state.transactions));
  localStorage.setItem(storageKeys.logs, JSON.stringify(state.logs));
  syncCategoryOptions();
}

function syncCategoryOptions() {
  const categories = Array.from(new Set([
    ...categorySuggestions,
    ...state.transactions.map((transaction) => transaction.category).filter(Boolean),
  ])).sort((left, right) => left.localeCompare(right));

  elements.categorySuggestions.innerHTML = categories.map((category) => `<option value="${escapeHtml(category)}"></option>`).join('');

  const currentCategory = elements.categoryFilter.value || 'all';
  const filterOptions = ['all', ...categories];
  elements.categoryFilter.innerHTML = filterOptions.map((category) => `<option value="${escapeHtml(category)}">${category === 'all' ? 'All categories' : escapeHtml(category)}</option>`).join('');
  elements.categoryFilter.value = filterOptions.includes(currentCategory) ? currentCategory : 'all';
}

function getTransactionsByDate(dateValue) {
  return state.transactions.filter((transaction) => transaction.date === dateValue);
}

function getTransactionsForMonth(year, month) {
  return state.transactions.filter((transaction) => {
    const transactionDate = new Date(transaction.date + 'T00:00:00');
    return transactionDate.getFullYear() === year && transactionDate.getMonth() === month;
  });
}

function getDailyTotals(dateValue) {
  const dailyTransactions = getTransactionsByDate(dateValue);
  return dailyTransactions.reduce(
    (totals, transaction) => {
      totals.count += 1;
      if (transaction.type === 'income') {
        totals.income += transaction.amount;
      } else {
        totals.expense += transaction.amount;
      }
      return totals;
    },
    { count: 0, income: 0, expense: 0 },
  );
}

function sumByType(transactions, type) {
  return transactions.filter((transaction) => transaction.type === type).reduce((sum, transaction) => sum + transaction.amount, 0);
}

function getFilteredTransactions() {
  return state.transactions.filter((transaction) => {
    const matchesType = state.filters.type === 'all' || transaction.type === state.filters.type;
    const matchesCategory = state.filters.category === 'all' || transaction.category === state.filters.category;
    const searchValue = state.filters.search;
    const matchesSearch =
      !searchValue ||
      transaction.category.toLowerCase().includes(searchValue) ||
      transaction.description.toLowerCase().includes(searchValue) ||
      transaction.amount.toString().includes(searchValue) ||
      transaction.date.includes(searchValue);

    return matchesType && matchesCategory && matchesSearch;
  });
}

function getLatestLogForTransaction(transactionId) {
  return state.logs.find((entry) => entry.transactionId === transactionId);
}

function createSyntheticLog(transaction) {
  return {
    actionLabel: 'Updated',
    timestamp: transaction.updatedAt,
  };
}

function openChartModal() {
  elements.chartModalInstance.show();
}

function renderChart() {
  const transactions = getFilteredTransactions();
  const expenses = transactions.filter((transaction) => transaction.type === 'expense');
  const grouped = expenses.reduce((accumulator, transaction) => {
    accumulator[transaction.category] = (accumulator[transaction.category] || 0) + transaction.amount;
    return accumulator;
  }, {});

  const labels = Object.keys(grouped);
  const values = labels.map((label) => grouped[label]);
  const canvas = elements.expenseChart;
  const context = canvas.getContext('2d');

  if (state.chartInstance) {
    state.chartInstance.destroy();
  }

  state.chartInstance = new Chart(context, {
    type: 'doughnut',
    data: {
      labels: labels.length > 0 ? labels : ['No expenses yet'],
      datasets: [
        {
          data: values.length > 0 ? values : [1],
          backgroundColor: labels.length > 0
            ? ['#f97316', '#22c55e', '#38bdf8', '#f43f5e', '#eab308', '#8b5cf6', '#14b8a6', '#fb7185']
            : ['rgba(148, 163, 184, 0.45)'],
          borderColor: 'rgba(15, 23, 42, 0.95)',
          borderWidth: 2,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          labels: {
            color: '#e5eefc',
            usePointStyle: true,
          },
        },
      },
    },
  });
}

function clearValidation() {
  elements.transactionForm.querySelectorAll('.is-invalid').forEach((field) => field.classList.remove('is-invalid'));
  elements.formAlert.classList.add('d-none');
  elements.formAlert.textContent = '';
}

function showFormError(message) {
  elements.formAlert.textContent = message;
  elements.formAlert.classList.remove('d-none');
}

function createTrendCard(label, value, className) {
  return `
    <div class="col-md-4">
      <div class="metric-card ${className}">
        <span>${label}</span>
        <strong>${formatCurrency(value)}</strong>
      </div>
    </div>
  `;
}

function createStatCard(label, value, className) {
  return `
    <div class="col-md-4">
      <div class="metric-card ${className}">
        <span>${label}</span>
        <strong>${formatCurrency(value)}</strong>
      </div>
    </div>
  `;
}

function getBalanceClass(amount) {
  if (amount > 0) {
    return 'positive';
  }
  if (amount < 0) {
    return 'negative';
  }
  return 'neutral';
}

function getBadgeClass(amount) {
  if (amount > 0) {
    return 'badge-soft-income';
  }
  if (amount < 0) {
    return 'badge-soft-expense';
  }
  return 'badge-soft-neutral';
}

function formatCurrency(amount) {
  return new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 2,
  }).format(amount);
}

function formatSignedCurrency(amount) {
  const value = formatCurrency(Math.abs(amount));
  if (amount > 0) {
    return `+${value}`;
  }
  if (amount < 0) {
    return `-${value}`;
  }
  return value;
}

function formatReadableDate(dateValue) {
  return new Date(dateValue + 'T00:00:00').toLocaleDateString(undefined, {
    weekday: 'short',
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

function formatDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function startOfMonth(date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function shiftMonth(date, amount) {
  return new Date(date.getFullYear(), date.getMonth() + amount, 1);
}

function loadJson(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) {
      return fallback;
    }
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : fallback;
  } catch {
    return fallback;
  }
}

function capitalize(value) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function escapeHtml(value) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}
