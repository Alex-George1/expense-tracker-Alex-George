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

const currencyFormatter = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 2,
});

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
  syncYearOptions();
  refreshAll();
});

function bindElements() {
  const ids = [
    'calendarTitle',
    'calendarGrid',
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
    'formTitle',
    'cancelEdit',
    'resetForm',
    'saveTransaction',
    'dayTransactionList',
    'formAlert',
    'openChart',
    'expenseChart',
    'prevMonth',
    'todayMonth',
    'nextMonth',
    'yearFilter',
    'categorySuggestions',
  ];

  ids.forEach((id) => {
    elements[id] = document.getElementById(id);
  });

  elements.dayModal = document.getElementById('dayModal');
  elements.chartModalElement = document.getElementById('chartModal');
  elements.dayModalInstance = getModalController(elements.dayModal);
  elements.chartModalInstance = getModalController(elements.chartModalElement);
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

  elements.yearFilter.addEventListener('change', (event) => {
    state.currentMonth = new Date(Number(event.target.value), state.currentMonth.getMonth(), 1);
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
  elements.resetForm.addEventListener('click', clearEditingState);
  elements.dayTransactionList.addEventListener('click', handleTransactionAction);
  elements.cancelEdit.addEventListener('click', clearEditingState);
  elements.openChart.addEventListener('click', openChartModal);
  elements.dayModal.addEventListener('hidden.bs.modal', clearEditingState);
  elements.chartModalElement.addEventListener('shown.bs.modal', scheduleChartRender);
  document.querySelectorAll('[data-modal-close]').forEach((button) => {
    button.addEventListener('click', () => {
      const target = button.getAttribute('data-modal-close');
      closeModal(target === 'chartModal' ? elements.chartModalElement : elements.dayModal);
    });
  });
}

function refreshAll() {
  syncCategoryOptions();
  refreshDashboard();
  refreshCalendar();
  refreshLogs();
  if (state.chartInstance && isChartModalVisible()) {
    scheduleChartRender();
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
  const monthDate = startOfMonth(state.currentMonth);
  const monthCells = getMonthCalendarCells(monthDate);
  const monthTransactions = getTransactionsForMonth(monthDate.getFullYear(), monthDate.getMonth());
  const dailyTotals = getDailyTotalsMap(monthTransactions);
  const today = formatDate(new Date());
  const monthLabel = monthDate.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });

  elements.calendarTitle.textContent = monthLabel;
  elements.monthOverviewTitle.textContent = monthLabel;
  elements.yearFilter.value = String(monthDate.getFullYear());
  elements.monthTrends.innerHTML = '';
  elements.calendarGrid.innerHTML = '';

  monthCells.forEach((cellData) => {
    const cell = document.createElement('button');
    cell.type = 'button';
    cell.className = `calendar-day${cellData.isEmpty ? ' is-empty' : ''}`;

    if (cellData.isEmpty) {
      cell.setAttribute('aria-hidden', 'true');
      cell.disabled = true;
      elements.calendarGrid.appendChild(cell);
      return;
    }

    const totals = dailyTotals[cellData.dateValue] || emptyDailyTotals();
    const net = totals.income - totals.expense;

    if (cellData.dateValue === today) {
      cell.classList.add('is-today');
    }
    if (cellData.dateValue === state.selectedDate) {
      cell.classList.add('is-selected');
    }
    const readableDate = formatReadableDate(cellData.dateValue);
    cell.title = `${readableDate} - Balance ${formatCurrency(net)}`;
    cell.setAttribute('aria-label', `${readableDate}. Balance ${formatCurrency(net)}.`);
    cell.innerHTML = `
      <div class="day-number">${cellData.dayNumber}</div>
      <div class="day-total">${formatSignedCurrency(net)}</div>
    `;
    cell.addEventListener('click', () => selectDay(cellData.dateValue));
    elements.calendarGrid.appendChild(cell);
  });

  const monthIncome = sumByType(monthTransactions, 'income');
  const monthExpenses = sumByType(monthTransactions, 'expense');
  const monthBalance = monthIncome - monthExpenses;

  elements.monthTrends.innerHTML = [
    createMetricCard('Income', monthIncome),
    createMetricCard('Expenses', monthExpenses),
    createMetricCard('Balance', monthBalance),
  ].join('');
}

function getMonthCalendarCells(monthDate) {
  const year = monthDate.getFullYear();
  const month = monthDate.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const startingOffset = new Date(year, month, 1).getDay();
  const cells = [];

  for (let index = 0; index < startingOffset; index += 1) {
    cells.push({ isEmpty: true });
  }

  for (let day = 1; day <= daysInMonth; day += 1) {
    cells.push({
      isEmpty: false,
      dayNumber: day,
      dateValue: formatDate(new Date(year, month, day)),
    });
  }

  return cells;
}

function syncYearOptions() {
  const currentYear = state.currentMonth.getFullYear();
  elements.yearFilter.innerHTML = Array.from({ length: 100 }, (_, index) => 2000 + index)
    .map((year) => `<option value="${year}">${year}</option>`)
    .join('');
  elements.yearFilter.value = String(currentYear);
}

function getDailyTotalsMap(transactions) {
  return transactions.reduce((totalsByDate, transaction) => {
    const totals = totalsByDate[transaction.date] || emptyDailyTotals();
    totals.count += 1;
    totals[transaction.type] += transaction.amount;
    totalsByDate[transaction.date] = totals;
    return totalsByDate;
  }, {});
}

function emptyDailyTotals() {
  return { count: 0, income: 0, expense: 0 };
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

function selectDay(dateValue) {
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
    createMetricCard('Income', totals.income),
    createMetricCard('Expenses', totals.expense),
    createMetricCard('Balance', net),
  ].join('');

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

}

function handleTransactionAction(event) {
  const button = event.target.closest('button[data-action]');
  if (!button) {
    return;
  }

  const action = button.getAttribute('data-action');
  const transactionId = button.getAttribute('data-id');

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

function closeModal(element) {
  const activeElement = document.activeElement;
  if (element && activeElement && element.contains(activeElement) && typeof activeElement.blur === 'function') {
    activeElement.blur();
  }

  if (element === elements.chartModalElement) {
    elements.chartModalInstance.hide();
  } else if (element === elements.dayModal) {
    elements.dayModalInstance.hide();
  }
}

function scheduleChartRender() {
  window.requestAnimationFrame(() => {
    window.requestAnimationFrame(renderChart);
  });
}

function isChartModalVisible() {
  return elements.chartModalElement.classList.contains('show');
}

function getModalController(element) {
  if (typeof bootstrap !== 'undefined' && bootstrap.Modal) {
    return bootstrap.Modal.getOrCreateInstance(element);
  }

  return {
    show() {
      if (element) {
        element.classList.add('show');
        element.style.display = 'block';
        window.requestAnimationFrame(() => {
          element.dispatchEvent(new Event('shown.bs.modal'));
        });
      }
    },
    hide() {
      if (element) {
        element.classList.remove('show');
        element.style.display = 'none';
        window.requestAnimationFrame(() => {
          element.dispatchEvent(new Event('hidden.bs.modal'));
        });
      }
    },
  };
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

function createMetricCard(label, value) {
  return `
    <div class="col-md-4">
      <div class="metric-card">
        <span>${label}</span>
        <strong>${formatCurrency(value)}</strong>
      </div>
    </div>
  `;
}

function formatCurrency(amount) {
  return currencyFormatter.format(amount);
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
